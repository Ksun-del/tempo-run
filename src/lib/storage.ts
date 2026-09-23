import AsyncStorage from '@react-native-async-storage/async-storage';
import { simplify, type TrackPoint } from './geo';

export type RunSummary = {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number;
  /** чистое время движения, мс (без пауз) */
  durationMs: number;
  distanceM: number;
  elevationGainM: number;
  /** время на каждой отметке километра (мс от старта, чистое время) */
  splits: number[];
  /** упрощённый трек (~80 точек) для превью в списке */
  preview?: TrackPoint[];
  /** когда пробежка отправлена в облако клуба (null — не отправлена) */
  clubSharedAt?: number | null;
};

export type Run = RunSummary & {
  points: TrackPoint[];
};

export type Settings = {
  voiceEnabled: boolean;
  /** интервал голосовых подсказок, км */
  voiceEveryKm: number;
  mapStyle: 'dark' | 'light';
  name: string;
  /** код клуба для облака */
  clubCode: string;
};

export const DEFAULT_SETTINGS: Settings = {
  voiceEnabled: true,
  voiceEveryKm: 1,
  mapStyle: 'dark',
  name: '',
  clubCode: '',
};

const INDEX_KEY = 'tempo:runs:index';
const RUN_KEY = (id: string) => `tempo:run:${id}`;
const SETTINGS_KEY = 'tempo:settings';

type Listener = () => void;
const listeners = new Set<Listener>();
export function onRunsChanged(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const emit = () => listeners.forEach((l) => l());

export async function listRuns(): Promise<RunSummary[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  const list: RunSummary[] = raw ? JSON.parse(raw) : [];
  return list.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getRun(id: string): Promise<Run | null> {
  const raw = await AsyncStorage.getItem(RUN_KEY(id));
  return raw ? JSON.parse(raw) : null;
}

export async function saveRun(run: Run): Promise<void> {
  const { points, ...rest } = run;
  const summary: RunSummary = {
    ...rest,
    preview: simplify(points, 80).map((p) => ({ lat: p.lat, lon: p.lon, t: p.t, seg: p.seg })),
  };
  await AsyncStorage.setItem(RUN_KEY(run.id), JSON.stringify({ ...summary, points }));
  const list = (await listRuns()).filter((r) => r.id !== run.id);
  list.push(summary);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
  emit();
}

export async function updateRunTitle(id: string, title: string): Promise<void> {
  const run = await getRun(id);
  if (!run) return;
  await saveRun({ ...run, title });
}

export async function markClubShared(id: string, at: number | null): Promise<void> {
  const run = await getRun(id);
  if (!run) return;
  await saveRun({ ...run, clubSharedAt: at });
}

export async function deleteRun(id: string): Promise<void> {
  await AsyncStorage.removeItem(RUN_KEY(id));
  const list = (await listRuns()).filter((r) => r.id !== id);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
  emit();
}

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
}

export async function saveSettings(s: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...s };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
