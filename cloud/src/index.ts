/**
 * Облако клуба для приложения «Темп».
 *
 * Доступ — по секретному коду клуба (переменная CLUB_CODE, задаётся `wrangler secret put CLUB_CODE`).
 * Каждый телефон присылает свой случайный device-id: по нему приложение может обновить
 * или удалить только свои пробежки. Наружу device-id никогда не отдаётся.
 */

type Point = [lat: number, lon: number, seg: number];

type RunIn = {
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

const TZ_OFFSET_MS = 3 * 3600 * 1000; // Ростов-на-Дону, UTC+3
const MAX_TRACK = 2000;
const MAX_PREVIEW = 200;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS runs (
    public_id TEXT PRIMARY KEY,
    device TEXT NOT NULL,
    run_id TEXT NOT NULL,
    runner TEXT NOT NULL,
    title TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    distance_m REAL NOT NULL,
    elevation_m INTEGER NOT NULL DEFAULT 0,
    splits TEXT NOT NULL DEFAULT '[]',
    preview TEXT NOT NULL DEFAULT '[]',
    track TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    UNIQUE (device, run_id)
  )`,
  `CREATE INDEX IF NOT EXISTS runs_started ON runs (started_at DESC)`,
];

let schemaReady = false;
async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  schemaReady = true;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
  });
}
const fail = (status: number, error: string) => json({ error }, status);

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

function validateRun(b: any): RunIn | string {
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
function periodStart(period: string, now = Date.now()): number {
  const local = new Date(now + TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  if (period === 'month') local.setUTCDate(1);
  else local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.getTime() - TZ_OFFSET_MS;
}

type Row = Record<string, unknown>;
const feedItem = (r: Row, device: string) => ({
  id: r.public_id,
  runner: r.runner,
  title: r.title,
  startedAt: r.started_at,
  durationMs: r.duration_ms,
  distanceM: r.distance_m,
  elevationGainM: r.elevation_m,
  preview: JSON.parse(String(r.preview)),
  mine: r.device === device,
});

export default {
  async fetch(req: Request, env: { DB: D1Database; CLUB_CODE?: string }): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
          'access-control-allow-headers': 'content-type,x-club-code,x-device-id',
        },
      });
    }
    if (url.pathname === '/') return new Response('Темп · облако клуба работает', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (!url.pathname.startsWith('/api/')) return fail(404, 'не найдено');

    // Доступ по коду клуба
    const code = req.headers.get('x-club-code') ?? '';
    if (!env.CLUB_CODE) return fail(503, 'код клуба ещё не задан на сервере');
    if (!safeEqual(norm(code), norm(env.CLUB_CODE))) return fail(401, 'неверный код клуба');
    const device = req.headers.get('x-device-id') ?? '';
    if (!/^[A-Za-z0-9-]{16,64}$/.test(device)) return fail(400, 'нет device-id');

    await ensureSchema(env.DB);
    const db = env.DB;
    const path = url.pathname.replace(/\/+$/, '');

    // Проверка подключения
    if (path === '/api/ping' && req.method === 'GET') {
      const c = await db.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT device) AS people FROM runs').first<Row>();
      return json({ ok: true, runs: c?.n ?? 0, people: c?.people ?? 0 });
    }

    // Отправить / обновить свою пробежку
    if (path === '/api/runs' && req.method === 'POST') {
      if (Number(req.headers.get('content-length') ?? 0) > 1_000_000) return fail(413, 'слишком большой трек');
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return fail(400, 'не JSON');
      }
      const run = validateRun(body);
      if (typeof run === 'string') return fail(400, `ошибка в поле: ${run}`);
      const existing = await db
        .prepare('SELECT public_id FROM runs WHERE device = ? AND run_id = ?')
        .bind(device, run.runId)
        .first<Row>();
      const id = (existing?.public_id as string) ?? crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO runs (public_id, device, run_id, runner, title, started_at, duration_ms, distance_m, elevation_m, splits, preview, track, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
           ON CONFLICT (device, run_id) DO UPDATE SET
             runner = excluded.runner, title = excluded.title, started_at = excluded.started_at,
             duration_ms = excluded.duration_ms, distance_m = excluded.distance_m, elevation_m = excluded.elevation_m,
             splits = excluded.splits, preview = excluded.preview, track = excluded.track`,
        )
        .bind(
          id,
          device,
          run.runId,
          run.runner,
          run.title,
          run.startedAt,
          run.durationMs,
          run.distanceM,
          run.elevationGainM,
          JSON.stringify(run.splits),
          JSON.stringify(run.preview),
          JSON.stringify(run.track),
          Date.now(),
        )
        .run();
      return json({ ok: true, id });
    }

    // Лента клуба (новые сверху), постранично: ?before=<startedAt>
    if (path === '/api/feed' && req.method === 'GET') {
      const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100);
      const { results } = await db
        .prepare(
          `SELECT public_id, device, runner, title, started_at, duration_ms, distance_m, elevation_m, preview
           FROM runs WHERE started_at < ? ORDER BY started_at DESC LIMIT ?`,
        )
        .bind(before, limit)
        .all<Row>();
      return json({ items: results.map((r) => feedItem(r, device)) });
    }

    // Одна пробежка целиком (с треком и сплитами)
    const one = path.match(/^\/api\/runs\/([0-9a-f-]{36})$/);
    if (one && req.method === 'GET') {
      const r = await db.prepare('SELECT * FROM runs WHERE public_id = ?').bind(one[1]).first<Row>();
      if (!r) return fail(404, 'пробежка не найдена');
      return json({ ...feedItem(r, device), splits: JSON.parse(String(r.splits)), track: JSON.parse(String(r.track)) });
    }

    // Убрать свою пробежку из клуба (по номеру пробежки в телефоне)
    const del = path.match(/^\/api\/my-runs\/([^/]{1,64})$/);
    if (del && req.method === 'DELETE') {
      await db.prepare('DELETE FROM runs WHERE device = ? AND run_id = ?').bind(device, decodeURIComponent(del[1])).run();
      return json({ ok: true });
    }

    // Рейтинг за неделю / месяц
    if (path === '/api/leaderboard' && req.method === 'GET') {
      const period = url.searchParams.get('period') === 'month' ? 'month' : 'week';
      const from = periodStart(period);
      const { results } = await db
        .prepare(
          `SELECT r.device AS device,
                  (SELECT runner FROM runs x WHERE x.device = r.device ORDER BY x.started_at DESC LIMIT 1) AS runner,
                  SUM(r.distance_m) AS distance_m, SUM(r.duration_ms) AS duration_ms, COUNT(*) AS runs,
                  MAX(r.distance_m) AS longest_m
           FROM runs r WHERE r.started_at >= ?
           GROUP BY r.device ORDER BY distance_m DESC LIMIT 100`,
        )
        .bind(from)
        .all<Row>();
      return json({
        period,
        from,
        items: results.map((r, i) => ({
          place: i + 1,
          runner: r.runner,
          distanceM: r.distance_m,
          durationMs: r.duration_ms,
          runs: r.runs,
          longestM: r.longest_m,
          mine: r.device === device,
        })),
      });
    }

    return fail(404, 'не найдено');
  },
};
