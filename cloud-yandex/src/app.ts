/**
 * Облако клуба Pobeda Run — логика запросов, не зависящая от базы.
 * Доступ по коду клуба (переменная окружения CLUB_CODE), у каждого телефона свой device-id.
 */

export type Point = [lat: number, lon: number, seg: number];

export type RunIn = {
  runId: string;
  runner: string;
  title: string;
  startedAt: number;
  durationMs: number;
  distanceM: number;
  elevationGainM: number;
  splits: number[];
  preview: Point[];
  track: Point[];
};

export type Summary = {
  id: string;
  device: string;
  runner: string;
  title: string;
  startedAt: number;
  durationMs: number;
  distanceM: number;
  elevationGainM: number;
  preview: Point[];
};

export type Full = Summary & { splits: number[]; track: Point[] };

export interface Store {
  stats(): Promise<{ runs: number; people: number }>;
  /** Сохранить (или обновить свою) пробежку, вернуть публичный id */
  upsert(device: string, run: RunIn, newId: string): Promise<string>;
  feed(before: number, limit: number): Promise<Summary[]>;
  get(id: string): Promise<Full | null>;
  remove(device: string, runId: string): Promise<void>;
  since(from: number): Promise<Summary[]>;
}

export type Req = {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>; // ключи в нижнем регистре
  body: string;
};
export type Res = { status: number; body: unknown };

const TZ_OFFSET_MS = 3 * 3600 * 1000; // Ростов-на-Дону, UTC+3
const MAX_TRACK = 2000;
const MAX_PREVIEW = 200;

const ok = (body: unknown): Res => ({ status: 200, body });
const fail = (status: number, error: string): Res => ({ status, body: { error } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const norm = (s: string) => s.trim().toUpperCase();

function isPoints(v: unknown, max: number): v is Point[] {
  return (
    Array.isArray(v) &&
    v.length <= max &&
    v.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 3 &&
        typeof p[0] === 'number' &&
        typeof p[1] === 'number' &&
        typeof p[2] === 'number' &&
        Math.abs(p[0]) <= 90 &&
        Math.abs(p[1]) <= 180,
    )
  );
}

export function validateRun(b: any): RunIn | string {
  if (!b || typeof b !== 'object') return 'пустой запрос';
  const str = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!str(b.runId, 64)) return 'runId';
  if (!str(b.runner, 40)) return 'имя';
  if (!str(b.title, 80)) return 'название';
  if (!num(b.startedAt) || !num(b.durationMs) || !num(b.distanceM)) return 'числа';
  if (b.distanceM > 400_000 || b.durationMs > 48 * 3600_000) return 'слишком длинная пробежка';
  if (!Array.isArray(b.splits) || b.splits.length > 500 || !b.splits.every(num)) return 'сплиты';
  if (!isPoints(b.preview, MAX_PREVIEW)) return 'превью';
  if (!isPoints(b.track, MAX_TRACK)) return 'трек';
  return {
    runId: b.runId,
    runner: b.runner.trim(),
    title: b.title.trim(),
    startedAt: Math.round(b.startedAt),
    durationMs: Math.round(b.durationMs),
    distanceM: b.distanceM,
    elevationGainM: num(b.elevationGainM) ? Math.round(b.elevationGainM) : 0,
    splits: b.splits,
    preview: b.preview,
    track: b.track,
  };
}

/** Начало недели (пн) или месяца по ростовскому времени, в мс UTC */
export function periodStart(period: string, now = Date.now()): number {
  const local = new Date(now + TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  if (period === 'month') local.setUTCDate(1);
  else local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.getTime() - TZ_OFFSET_MS;
}

const feedItem = (r: Summary, device: string) => ({
  id: r.id,
  runner: r.runner,
  title: r.title,
  startedAt: r.startedAt,
  durationMs: r.durationMs,
  distanceM: r.distanceM,
  elevationGainM: r.elevationGainM,
  preview: r.preview,
  mine: r.device === device,
});

export async function handle(req: Req, store: Store, clubCode: string | undefined, uuid: () => string): Promise<Res> {
  const path = (req.path || '/').replace(/\/+$/, '') || '/';
  if (path === '/') return ok({ ok: true, name: 'Pobeda Run · облако клуба' });
  if (!path.startsWith('/api/')) return fail(404, 'не найдено');

  if (!clubCode) return fail(503, 'код клуба ещё не задан на сервере');
  if (!safeEqual(norm(req.headers['x-club-code'] ?? ''), norm(clubCode))) return fail(401, 'неверный код клуба');
  const device = req.headers['x-device-id'] ?? '';
  if (!/^[A-Za-z0-9-]{16,64}$/.test(device)) return fail(400, 'нет device-id');

  if (path === '/api/ping' && req.method === 'GET') {
    const s = await store.stats();
    return ok({ ok: true, runs: s.runs, people: s.people });
  }

  if (path === '/api/runs' && req.method === 'POST') {
    if (req.body.length > 1_000_000) return fail(413, 'слишком большой трек');
    let body: unknown;
    try {
      body = JSON.parse(req.body);
    } catch {
      return fail(400, 'не JSON');
    }
    const run = validateRun(body);
    if (typeof run === 'string') return fail(400, `ошибка в поле: ${run}`);
    const id = await store.upsert(device, run, uuid());
    return ok({ ok: true, id });
  }

  if (path === '/api/feed' && req.method === 'GET') {
    const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
    const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || 30, 1), 100);
    const rows = await store.feed(before, limit);
    return ok({ items: rows.map((r) => feedItem(r, device)) });
  }

  const one = path.match(/^\/api\/runs\/([0-9a-f-]{36})$/);
  if (one && req.method === 'GET') {
    const r = await store.get(one[1]);
    if (!r) return fail(404, 'пробежка не найдена');
    return ok({ ...feedItem(r, device), splits: r.splits, track: r.track });
  }

  const del = path.match(/^\/api\/my-runs\/([^/]{1,64})$/);
  if (del && req.method === 'DELETE') {
    await store.remove(device, decodeURIComponent(del[1]));
    return ok({ ok: true });
  }

  if (path === '/api/leaderboard' && req.method === 'GET') {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const from = periodStart(period);
    const rows = await store.since(from);
    const by = new Map<string, { runner: string; last: number; distanceM: number; durationMs: number; runs: number; longestM: number }>();
    for (const r of rows) {
      const a = by.get(r.device) ?? { runner: r.runner, last: 0, distanceM: 0, durationMs: 0, runs: 0, longestM: 0 };
      if (r.startedAt >= a.last) {
        a.last = r.startedAt;
        a.runner = r.runner;
      }
      a.distanceM += r.distanceM;
      a.durationMs += r.durationMs;
      a.runs += 1;
      a.longestM = Math.max(a.longestM, r.distanceM);
      by.set(r.device, a);
    }
    const items = [...by.entries()]
      .sort((x, y) => y[1].distanceM - x[1].distanceM)
      .slice(0, 100)
      .map(([dev, a], i) => ({
        place: i + 1,
        runner: a.runner,
        distanceM: a.distanceM,
        durationMs: a.durationMs,
        runs: a.runs,
        longestM: a.longestM,
        mine: dev === device,
      }));
    return ok({ period, from, items });
  }

  return fail(404, 'не найдено');
}
