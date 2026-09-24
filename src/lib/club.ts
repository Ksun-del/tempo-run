/**
 * Облако клуба: отправка своих пробежек, лента и рейтинг.
 * Доступ по коду клуба (вводится в Настройках).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { CLUB_API_URL } from './config';
import { simplify, type TrackPoint } from './geo';
import { getRun, getSettings, markClubShared, type Run } from './storage';

const DEVICE_KEY = 'tempo:device-id';

export type ClubPoint = [number, number, number];

export type ClubFeedItem = {
  id: string;
  runner: string;
  title: string;
  startedAt: number;
  durationMs: number;
  distanceM: number;
  elevationGainM: number;
  preview: ClubPoint[];
  mine: boolean;
};

export type ClubRun = ClubFeedItem & { splits: number[]; track: ClubPoint[] };

export type LeaderRow = {
  place: number;
  runner: string;
  distanceM: number;
  durationMs: number;
  runs: number;
  longestM: number;
  mine: boolean;
};

export class ClubError extends Error {}

export const clubConfigured = () => CLUB_API_URL.length > 0;

async function deviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/**
 * У функции Yandex Cloud один адрес, поэтому путь передаётся параметром ?path=...
 * (для старого облака на Cloudflare путь дописывается к адресу как раньше).
 */
function apiUrl(path: string): string {
  const base = CLUB_API_URL.replace(/\/$/, '');
  if (!base.includes('functions.yandexcloud.net')) return base + path;
  const [p, q] = path.split('?');
  return `${base}?path=${encodeURIComponent(p)}${q ? `&${q}` : ''}`;
}

async function request<T>(path: string, init: RequestInit = {}, codeOverride?: string): Promise<T> {
  if (!clubConfigured()) throw new ClubError('Облако клуба ещё не подключено к приложению.');
  const code = codeOverride ?? (await getSettings()).clubCode;
  if (!code) throw new ClubError('Введи код клуба в Настройках.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-club-code': code,
        'x-device-id': await deviceId(),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ClubError('Нет связи с облаком клуба. Проверь интернет.');
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new ClubError(data?.error ? `Облако: ${data.error}` : `Ошибка облака (${res.status})`);
  return data as T;
}

const pack = (pts: TrackPoint[], max: number): ClubPoint[] =>
  simplify(pts, max).map((p) => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5, p.seg]);

export const unpack = (pts: ClubPoint[]): TrackPoint[] => pts.map(([lat, lon, seg]) => ({ lat, lon, seg, t: 0 }));

export async function checkClubCode(code: string) {
  return request<{ ok: true; runs: number; people: number }>('/api/ping', {}, code);
}

export async function shareRun(run: Run): Promise<void> {
  const { name } = await getSettings();
  if (!name.trim()) throw new ClubError('Укажи своё имя в Настройках — его увидят в клубе.');
  await request('/api/runs', {
    method: 'POST',
    body: JSON.stringify({
      runId: run.id,
      runner: name.trim().slice(0, 40),
      title: run.title.slice(0, 80),
      startedAt: run.startedAt,
      durationMs: run.durationMs,
      distanceM: run.distanceM,
      elevationGainM: run.elevationGainM,
      splits: run.splits,
      preview: pack(run.points, 80),
      track: pack(run.points, 1500),
    }),
  });
  await markClubShared(run.id, Date.now());
}

export async function unshareRun(runId: string): Promise<void> {
  await request(`/api/my-runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
  await markClubShared(runId, null);
}

/** Если пробежка уже в клубе — обновить её там (например, после переименования). */
export async function resyncIfShared(runId: string) {
  const run = await getRun(runId);
  if (run?.clubSharedAt) await shareRun(run).catch(() => {});
}

export async function fetchFeed(before?: number) {
  const q = before ? `?before=${before}` : '';
  return (await request<{ items: ClubFeedItem[] }>(`/api/feed${q}`)).items;
}

export async function fetchClubRun(id: string) {
  return request<ClubRun>(`/api/runs/${id}`);
}

export async function fetchLeaderboard(period: 'week' | 'month') {
  return (await request<{ items: LeaderRow[] }>(`/api/leaderboard?period=${period}`)).items;
}
