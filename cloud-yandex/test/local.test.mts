import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { handle, periodStart, type Store, type Summary, type Full, type RunIn } from '../src/app.ts';

// Хранилище в памяти, повторяет логику YdbStore
class Mem implements Store {
  runs = new Map<string, Full>(); mine = new Map<string, string>();
  async stats() { return { runs: this.mine.size, people: new Set([...this.mine.keys()].map(k => k.split('|')[0])).size }; }
  async upsert(device: string, r: RunIn, newId: string) {
    const k = device + '|' + r.runId; const id = this.mine.get(k) ?? newId; this.mine.set(k, id);
    this.runs.set(id, { id, device, runner: r.runner, title: r.title, startedAt: r.startedAt, durationMs: r.durationMs, distanceM: r.distanceM, elevationGainM: r.elevationGainM, preview: r.preview, splits: r.splits, track: r.track });
    return id;
  }
  async feed(before: number, limit: number) { return [...this.runs.values()].filter(r => r.startedAt < before).sort((a, b) => b.startedAt - a.startedAt).slice(0, limit); }
  async get(id: string) { return this.runs.get(id) ?? null; }
  async remove(device: string, runId: string) { const k = device + '|' + runId; const id = this.mine.get(k); if (id) { this.runs.delete(id); this.mine.delete(k); } }
  async since(from: number) { return [...this.runs.values()].filter(r => r.startedAt >= from) as Summary[]; }
}
const s = new Mem();
const A = 'aaaaaaaa-1111-2222-3333-444444444444', B = 'bbbbbbbb-1111-2222-3333-444444444444';
const call = (method: string, path: string, dev = A, body = '', query: Record<string, string> = {}, code = 'pobeda2026') =>
  handle({ method, path, query, headers: { 'x-club-code': code, 'x-device-id': dev }, body }, s, 'POBEDA2026', randomUUID);
const now = Date.now();
const run = (id: string, km: number, t = now) => JSON.stringify({ runId: id, runner: 'Катя', title: 'Утренняя', startedAt: t, durationMs: km * 330000, distanceM: km * 1000, elevationGainM: 10, splits: [330000], preview: [[47.2, 39.7, 0]], track: [[47.2, 39.7, 0], [47.21, 39.71, 0]] });

assert.equal((await call('GET', '/api/ping', A, '', {}, 'wrong')).status, 401);
assert.equal((await call('GET', '/api/ping', 'short')).status, 400);
let r = await call('POST', '/api/runs', A, run('r1', 5.8)); assert.equal(r.status, 200); const id = (r.body as any).id;
r = await call('POST', '/api/runs', A, run('r1', 6.0)); assert.equal((r.body as any).id, id, 'повтор не создаёт дубль');
await call('POST', '/api/runs', B, run('x', 10));
assert.deepEqual((await call('GET', '/api/ping')).body, { ok: true, runs: 2, people: 2 });
r = await call('GET', '/api/feed'); assert.equal((r.body as any).items.length, 2);
r = await call('GET', `/api/runs/${id}`); assert.equal((r.body as any).track.length, 2); assert.equal((r.body as any).mine, true);
r = await call('GET', '/api/leaderboard', A, '', { period: 'week' }); assert.equal((r.body as any).items[0].distanceM, 10000); assert.equal((r.body as any).items[1].mine, true);
assert.equal((await call('POST', '/api/runs', A, '{"runId":""}')).status, 400);
await call('DELETE', '/api/my-runs/r1');
assert.deepEqual((await call('GET', '/api/ping')).body, { ok: true, runs: 1, people: 1 });
// понедельник 00:00 по Ростову
const ws = new Date(periodStart('week', Date.UTC(2026, 8, 24, 10)) + 3 * 3600e3); assert.equal(ws.getUTCDay(), 1); assert.equal(ws.getUTCHours(), 0);
console.log('логика: OK');

// Проверка точки входа из собранного бандла (без базы)
const { createRequire } = await import('node:module');
const mod = createRequire(import.meta.url)('../dist/index.js');
delete process.env.YDB_ENDPOINT;
let out = await mod.handler({ httpMethod: 'GET', queryStringParameters: { path: '/api/ping' }, headers: {} }, {});
assert.equal(out.statusCode, 503);
process.env.YDB_ENDPOINT = 'grpcs://ydb.serverless.yandexcloud.net:2135/?database=/ru-central1/b1g/etn';
out = await mod.handler({ httpMethod: 'GET', queryStringParameters: { path: '/api/ping' }, headers: {} }, {});
assert.match(out.body, /сервисный аккаунт/);
console.log('бандл: OK');
