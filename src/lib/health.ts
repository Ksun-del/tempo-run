/**
 * Health Connect (Android): тренировки с часов Xiaomi, Amazfit, Samsung и других приложений.
 */
import {
  aggregateRecord,
  ExerciseType,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestExerciseRoute,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { TrackPoint } from './geo';
import { saveImported } from './importRun';
import { getRun } from './storage';

export type HealthRun = {
  id: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  title: string | null;
  source: string;
  hasRoute: boolean;
  imported: boolean;
  /** маршрут, если Health Connect отдал его сразу */
  route?: TrackPoint[];
};

export const healthSupported = true;

const SOURCES: Record<string, string> = {
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.mi.health': 'Mi Fitness',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.huawei.health': 'Huawei Health',
  'com.strava': 'Strava',
  'com.garmin.android.apps.connectmobile': 'Garmin',
};

export class HealthError extends Error {}

const toPoint = (l: { latitude: number; longitude: number; time: string; altitude?: { value: number } }): TrackPoint => ({
  lat: l.latitude,
  lon: l.longitude,
  t: Date.parse(l.time),
  alt: l.altitude?.value ?? null,
  seg: 0,
});

export async function connectHealth(): Promise<void> {
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new HealthError('На телефоне нет Health Connect или его нужно обновить. Установи «Health Connect» из Google Play.');
  }
  if (!(await initialize())) throw new HealthError('Health Connect не запустился.');
  const granted = await requestPermission([
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'HeartRate' },
  ]);
  if (!granted.some((p) => 'recordType' in p && p.recordType === 'ExerciseSession')) {
    throw new HealthError('Нужно разрешить RUN читать тренировки в Health Connect.');
  }
}

/** Пробежки за последние days дней */
export async function listHealthRuns(days = 60): Promise<HealthRun[]> {
  await connectHealth();
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const { records } = await readRecords('ExerciseSession', {
    timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
  });
  const runs = records.filter((r) => r.exerciseType === ExerciseType.RUNNING || r.exerciseType === ExerciseType.RUNNING_TREADMILL);
  const out: HealthRun[] = [];
  for (const r of runs) {
    const id = `hc-${r.metadata?.id ?? r.startTime}`;
    let distanceM = 0;
    try {
      const agg = await aggregateRecord({
        recordType: 'Distance',
        timeRangeFilter: { operator: 'between', startTime: r.startTime, endTime: r.endTime },
      });
      distanceM = agg.DISTANCE?.inMeters ?? 0;
    } catch {}
    const pkg = r.metadata?.dataOrigin ?? '';
    const ready = r.exerciseRoute?.route ?? [];
    out.push({
      id,
      startedAt: Date.parse(r.startTime),
      endedAt: Date.parse(r.endTime),
      distanceM,
      title: r.title ?? null,
      source: SOURCES[pkg] ?? (pkg || 'другое приложение'),
      hasRoute: ready.length > 0 || r.exerciseRoute?.type === 2,
      route: ready.length > 0 ? ready.map(toPoint) : undefined,
      imported: !!(await getRun(id)),
    });
  }
  return out.sort((a, b) => b.startedAt - a.startedAt);
}

/** Добавить пробежку из Health Connect (маршрут — если часы его передали и ты разрешила) */
export async function importHealthRun(h: HealthRun): Promise<string | null> {
  let points: TrackPoint[] = h.route ?? [];
  if (!points.length && h.hasRoute) {
    try {
      // часы записали маршрут, но Android спросит разрешение на эту тренировку
      points = ((await requestExerciseRoute(h.id.slice(3))) ?? []).map(toPoint);
    } catch {
      // не разрешили — добавим без карты
    }
  }
  return saveImported({ id: h.id, title: h.title, points, startedAt: h.startedAt, endedAt: h.endedAt, distanceM: h.distanceM });
}

export function openHealthSettings() {
  openHealthConnectSettings();
}
