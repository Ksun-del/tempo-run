/**
 * Запись пробежки.
 *
 * На Android геолокация идёт через foreground service (уведомление «Идёт тренировка»),
 * поэтому трек пишется и с заблокированным экраном. Если сервис недоступен
 * (например, в Expo Go), переключаемся на обычное отслеживание и не даём экрану гаснуть.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { PermissionsAndroid, Platform } from 'react-native';
import { defaultRunTitle, elevationGain, haversine, type TrackPoint } from './geo';
import { getSettings, saveRun, type Run, type Settings } from './storage';
import { announceFinish, announceSplit, say } from './voice';

export const LOCATION_TASK = 'tempo-location-task';
const ACTIVE_KEY = 'tempo:active-run';
/** Ставится перед запуском фонового сервиса и снимается после первой успешной точки.
 *  Если приложение упало между этими моментами — фоновая запись на этом телефоне отключается. */
const BG_GUARD_KEY = 'tempo:bg-guard';
const BG_BROKEN_KEY = 'tempo:bg-broken';
const KEEP_AWAKE_TAG = 'tempo-run';

/** Точки хуже этой точности (м) отбрасываем */
const MAX_ACCURACY_M = 35;
/** Скачки быстрее этой скорости (м/с ≈ 43 км/ч) считаем ошибкой GPS */
const MAX_SPEED_MS = 12;
/** Меньшие смещения считаем дрожанием GPS на месте */
const MIN_STEP_M = 4;

export type RunStatus = 'running' | 'paused';

export type ActiveRun = {
  id: string;
  startedAt: number;
  status: RunStatus;
  pausedAt: number | null;
  pausedTotal: number;
  lastResumeAt: number;
  seg: number;
  points: TrackPoint[];
  distanceM: number;
  splits: number[];
  mode: 'background' | 'foreground';
  /** последняя точка, даже если она не попала в трек — для карты */
  lastFix: { lat: number; lon: number; acc: number | null } | null;
};

let state: ActiveRun | null = null;
let loaded = false;
let settings: Settings | null = null;
let watchSub: Location.LocationSubscription | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let bgBroken = false;
let guardArmed = false;

type Listener = (s: ActiveRun | null) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

function notify() {
  listeners.forEach((l) => l(state));
}

export function getActive() {
  return state;
}

/** Чистое время движения на момент `at` */
export function movingTime(run: ActiveRun, at = Date.now()): number {
  const pausedNow = run.status === 'paused' && run.pausedAt ? at - run.pausedAt : 0;
  return Math.max(0, at - run.startedAt - run.pausedTotal - pausedNow);
}

function persistSoon(immediate = false) {
  if (persistTimer) clearTimeout(persistTimer);
  const write = () => {
    persistTimer = null;
    if (state) AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(state)).catch(() => {});
    else AsyncStorage.removeItem(ACTIVE_KEY).catch(() => {});
  };
  if (immediate) write();
  else persistTimer = setTimeout(write, 4000);
}

/** Загружает незавершённую тренировку (если приложение было закрыто во время бега). */
export async function ensureLoaded(): Promise<ActiveRun | null> {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    if (raw && !state) state = JSON.parse(raw);
  } catch {
    state = null;
  }
  try {
    bgBroken = (await AsyncStorage.getItem(BG_BROKEN_KEY)) === '1';
    // Прошлый запуск фоновой записи закончился падением — больше не пробуем
    if (!guardArmed && (await AsyncStorage.getItem(BG_GUARD_KEY))) {
      bgBroken = true;
      await AsyncStorage.multiSet([[BG_BROKEN_KEY, '1']]);
      await AsyncStorage.removeItem(BG_GUARD_KEY);
      try {
        if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK);
        }
      } catch {}
      if (state) state.mode = 'foreground';
    }
  } catch {}
  if (!settings) settings = await getSettings();
  notify();
  return state;
}

function handleLocations(locations: Location.LocationObject[]) {
  if (!state) return;
  let changed = false;
  for (const loc of locations) {
    const { latitude: lat, longitude: lon, accuracy, altitude } = loc.coords;
    state.lastFix = { lat, lon, acc: accuracy ?? null };
    changed = true;
    if (state.status !== 'running') continue;
    const t = loc.timestamp;
    if (t < state.lastResumeAt - 1500) continue;
    if (accuracy != null && accuracy > MAX_ACCURACY_M) continue;

    const point: TrackPoint = { lat, lon, t, alt: altitude, seg: state.seg };
    const prev = state.points[state.points.length - 1];
    if (!prev || prev.seg !== state.seg) {
      state.points.push(point);
      continue;
    }
    const d = haversine(prev.lat, prev.lon, lat, lon);
    const dt = (t - prev.t) / 1000;
    if (dt <= 0) continue;
    if (d / dt > MAX_SPEED_MS) continue;
    if (d < MIN_STEP_M) continue;

    const prevDist = state.distanceM;
    const prevMoving = prev.t - state.startedAt - state.pausedTotal;
    const curMoving = t - state.startedAt - state.pausedTotal;
    state.points.push(point);
    state.distanceM += d;

    // Отметки километров: время пересечения интерполируем между двумя точками
    while (state.distanceM >= (state.splits.length + 1) * 1000) {
      const target = (state.splits.length + 1) * 1000;
      const frac = (target - prevDist) / d;
      const at = prevMoving + frac * (curMoving - prevMoving);
      const lastKm = at - (state.splits[state.splits.length - 1] ?? 0);
      state.splits.push(at);
      const km = state.splits.length;
      const every = settings?.voiceEveryKm ?? 1;
      if ((settings?.voiceEnabled ?? true) && km % every === 0) announceSplit(km, at, lastKm);
    }
  }
  if (changed) {
    notify();
    persistSoon();
  }
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    await ensureLoaded();
    handleLocations(data.locations);
    if (guardArmed) {
      guardArmed = false;
      AsyncStorage.removeItem(BG_GUARD_KEY).catch(() => {});
    }
  });
}

async function startUpdates(): Promise<'background' | 'foreground'> {
  const options = {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
  };
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {}
  try {
    if (bgBroken) throw new Error('фоновая запись отключена после сбоя');
    guardArmed = true;
    await AsyncStorage.setItem(BG_GUARD_KEY, String(Date.now()));
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      ...options,
      activityType: Location.LocationActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Идёт тренировка',
        notificationBody: 'RUN записывает маршрут',
        notificationColor: '#D7FF3A',
        killServiceOnDestroy: false,
      },
    });
    return 'background';
  } catch (e) {
    console.warn('Фоновая запись недоступна, пишем только при включённом экране', e);
    guardArmed = false;
    AsyncStorage.removeItem(BG_GUARD_KEY).catch(() => {});
    watchSub?.remove();
    watchSub = await Location.watchPositionAsync(options, (loc) => handleLocations([loc]));
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return 'foreground';
  }
}

async function stopUpdates() {
  guardArmed = false;
  AsyncStorage.removeItem(BG_GUARD_KEY).catch(() => {});
  watchSub?.remove();
  watchSub = null;
  deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {}
}

export class PermissionError extends Error {}

export async function ensurePermission(): Promise<void> {
  const cur = await Location.getForegroundPermissionsAsync();
  const res = cur.granted ? cur : await Location.requestForegroundPermissionsAsync();
  if (!res.granted) {
    throw new PermissionError('Без доступа к геолокации трек не записать. Разреши доступ в настройках телефона.');
  }
  // Android 13+: разрешение на уведомление «Идёт тренировка» (без него запись тоже работает)
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never).catch(() => {});
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      throw new PermissionError('Включи геолокацию (GPS) на телефоне.');
    }
  }
}

export async function startRun(): Promise<ActiveRun> {
  await ensurePermission();
  settings = await getSettings();
  const now = Date.now();
  state = {
    id: String(now),
    startedAt: now,
    status: 'running',
    pausedAt: null,
    pausedTotal: 0,
    lastResumeAt: now,
    seg: 0,
    points: [],
    distanceM: 0,
    splits: [],
    mode: 'background',
    lastFix: null,
  };
  loaded = true;
  notify();
  state.mode = await startUpdates();
  persistSoon(true);
  notify();
  if (settings.voiceEnabled) say('Тренировка началась');
  return state;
}

/** Если приложение перезапустилось посреди пробежки — возобновляем запись точек. */
export async function resumeTrackingIfNeeded() {
  const s = await ensureLoaded();
  if (!s) return;
  let running = false;
  try {
    running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {}
  if (!running && !watchSub) {
    s.mode = await startUpdates();
    notify();
  }
}

export function pauseRun() {
  if (!state || state.status !== 'running') return;
  state.status = 'paused';
  state.pausedAt = Date.now();
  if (settings?.voiceEnabled ?? true) say('Пауза');
  notify();
  persistSoon(true);
}

export function resumeRun() {
  if (!state || state.status !== 'paused') return;
  const now = Date.now();
  state.pausedTotal += now - (state.pausedAt ?? now);
  state.pausedAt = null;
  state.status = 'running';
  state.lastResumeAt = now;
  state.seg += 1;
  if (settings?.voiceEnabled ?? true) say('Продолжаем');
  notify();
  persistSoon(true);
}

/** Завершает тренировку. Возвращает сохранённую пробежку или null, если писать было нечего. */
export async function finishRun(save = true): Promise<Run | null> {
  if (!state) return null;
  const s = state;
  const endedAt = s.status === 'paused' && s.pausedAt ? s.pausedAt : Date.now();
  const durationMs = movingTime(s, endedAt);
  await stopUpdates();
  state = null;
  persistSoon(true);
  notify();
  if (!save || s.points.length < 2) return null;
  const run: Run = {
    id: s.id,
    title: defaultRunTitle(s.startedAt),
    startedAt: s.startedAt,
    endedAt,
    durationMs,
    distanceM: s.distanceM,
    elevationGainM: elevationGain(s.points),
    splits: s.splits,
    points: s.points,
  };
  await saveRun(run);
  if (settings?.voiceEnabled ?? true) announceFinish(run.distanceM, run.durationMs);
  return run;
}

export async function reloadSettings() {
  settings = await getSettings();
}

/** Фоновая запись отключена, потому что однажды привела к сбою */
export async function isBackgroundDisabled() {
  await ensureLoaded();
  return bgBroken;
}

/** Разрешить снова попробовать фоновую запись */
export async function resetBackgroundMode() {
  bgBroken = false;
  await AsyncStorage.multiRemove([BG_BROKEN_KEY, BG_GUARD_KEY]);
}
