/**
 * Хранение в YDB (serverless, Yandex Cloud).
 *
 * Таблицы (создаются сами при первом запуске):
 *  runs   — краткая информация, ключ (started_at, public_id): лента и рейтинг читают только нужный диапазон дат
 *  tracks — трек и сплиты, ключ public_id: читается, только когда открывают одну пробежку
 *  mine   — какая пробежка чья, ключ (device, run_id): обновление/удаление своей пробежки и статистика
 */
import { Driver } from '@ydbjs/core';
import { CredentialsProvider } from '@ydbjs/auth';
import { query, type QueryClient } from '@ydbjs/query';
import { Double, Int64, Text } from '@ydbjs/value/primitive';
import type { Full, Point, RunIn, Store, Summary } from './app';

/** Токен сервисного аккаунта приходит в каждом вызове функции (context.token) */
class FunctionTokenProvider extends CredentialsProvider {
  token = '';
  getToken(): Promise<string> {
    return Promise.resolve(this.token);
  }
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS runs (
    started_at Int64 NOT NULL,
    public_id Utf8 NOT NULL,
    device Utf8,
    run_id Utf8,
    runner Utf8,
    title Utf8,
    duration_ms Int64,
    distance_m Double,
    elevation_m Int64,
    preview Utf8,
    created_at Int64,
    PRIMARY KEY (started_at, public_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tracks (
    public_id Utf8 NOT NULL,
    started_at Int64,
    splits Utf8,
    track Utf8,
    PRIMARY KEY (public_id)
  )`,
  `CREATE TABLE IF NOT EXISTS mine (
    device Utf8 NOT NULL,
    run_id Utf8 NOT NULL,
    public_id Utf8,
    started_at Int64,
    PRIMARY KEY (device, run_id)
  )`,
];

const i64 = (n: number) => new Int64(BigInt(Math.round(n)));
const txt = (s: string) => new Text(s);
const num = (v: unknown) => (v == null ? 0 : Number(v));
const parse = <T>(v: unknown, dflt: T): T => {
  try {
    return v == null ? dflt : (JSON.parse(String(v)) as T);
  } catch {
    return dflt;
  }
};

type Row = Record<string, unknown>;
const toSummary = (r: Row): Summary => ({
  id: String(r.public_id),
  device: String(r.device ?? ''),
  runner: String(r.runner ?? ''),
  title: String(r.title ?? ''),
  startedAt: num(r.started_at),
  durationMs: num(r.duration_ms),
  distanceM: num(r.distance_m),
  elevationGainM: num(r.elevation_m),
  preview: parse<Point[]>(r.preview, []),
});

export class YdbStore implements Store {
  private creds = new FunctionTokenProvider();
  private driver: Driver;
  private sql: QueryClient;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string, token: string) {
    // Драйвер начинает подключаться сразу в конструкторе, поэтому токен нужен до его создания
    this.creds.token = token;
    this.driver = new Driver(connectionString, { credentialsProvider: this.creds });
    this.sql = query(this.driver);
  }

  close() {
    try {
      this.driver.close();
    } catch {}
  }

  setToken(token: string) {
    this.creds.token = token;
  }

  init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.driver.ready();
        for (const ddl of DDL) {
          try {
            await this.sql(ddl);
          } catch {
            // старые версии YDB не знают IF NOT EXISTS; «уже существует» — тоже нормально
            await this.sql(ddl.replace('IF NOT EXISTS ', '')).catch(() => undefined);
          }
        }
      })().catch((e) => {
        this.ready = null;
        throw e;
      });
    }
    return this.ready;
  }

  async stats() {
    const [[r]] = await this.sql<[Row]>`SELECT COUNT(*) AS n, COUNT(DISTINCT device) AS people FROM mine`;
    return { runs: num(r?.n), people: num(r?.people) };
  }

  async upsert(device: string, run: RunIn, newId: string): Promise<string> {
    return this.sql.begin(async (tx) => {
      const [old] = await tx<[Row]>`SELECT public_id, started_at FROM mine WHERE device = ${txt(device)} AND run_id = ${txt(run.runId)}`;
      const prev = old[0];
      const id = prev ? String(prev.public_id) : newId;
      if (prev && num(prev.started_at) !== run.startedAt) {
        await tx`DELETE FROM runs WHERE started_at = ${i64(num(prev.started_at))} AND public_id = ${txt(id)}`;
      }
      await tx`UPSERT INTO runs (started_at, public_id, device, run_id, runner, title, duration_ms, distance_m, elevation_m, preview, created_at)
        VALUES (${i64(run.startedAt)}, ${txt(id)}, ${txt(device)}, ${txt(run.runId)}, ${txt(run.runner)}, ${txt(run.title)},
                ${i64(run.durationMs)}, ${new Double(run.distanceM)}, ${i64(run.elevationGainM)}, ${txt(JSON.stringify(run.preview))}, ${i64(Date.now())})`;
      await tx`UPSERT INTO tracks (public_id, started_at, splits, track)
        VALUES (${txt(id)}, ${i64(run.startedAt)}, ${txt(JSON.stringify(run.splits))}, ${txt(JSON.stringify(run.track))})`;
      await tx`UPSERT INTO mine (device, run_id, public_id, started_at)
        VALUES (${txt(device)}, ${txt(run.runId)}, ${txt(id)}, ${i64(run.startedAt)})`;
      return id;
    });
  }

  async feed(before: number, limit: number): Promise<Summary[]> {
    const lim = this.sql.unsafe(String(Math.min(Math.max(Math.floor(limit), 1), 100)));
    const [rows] = await this.sql<[Row]>`
      SELECT started_at, public_id, device, runner, title, duration_ms, distance_m, elevation_m, preview
      FROM runs WHERE started_at < ${i64(Math.min(before, Number.MAX_SAFE_INTEGER))}
      ORDER BY started_at DESC, public_id DESC LIMIT ${lim}`;
    return rows.map(toSummary);
  }

  async get(id: string): Promise<Full | null> {
    const [tr] = await this.sql<[Row]>`SELECT started_at, splits, track FROM tracks WHERE public_id = ${txt(id)}`;
    const t = tr[0];
    if (!t) return null;
    const [rs] = await this.sql<[Row]>`
      SELECT started_at, public_id, device, runner, title, duration_ms, distance_m, elevation_m, preview
      FROM runs WHERE started_at = ${i64(num(t.started_at))} AND public_id = ${txt(id)}`;
    const r = rs[0];
    if (!r) return null;
    return { ...toSummary(r), splits: parse<number[]>(t.splits, []), track: parse<Point[]>(t.track, []) };
  }

  async remove(device: string, runId: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [old] = await tx<[Row]>`SELECT public_id, started_at FROM mine WHERE device = ${txt(device)} AND run_id = ${txt(runId)}`;
      const prev = old[0];
      if (!prev) return;
      const id = txt(String(prev.public_id));
      await tx`DELETE FROM runs WHERE started_at = ${i64(num(prev.started_at))} AND public_id = ${id}`;
      await tx`DELETE FROM tracks WHERE public_id = ${id}`;
      await tx`DELETE FROM mine WHERE device = ${txt(device)} AND run_id = ${txt(runId)}`;
    });
  }

  async since(from: number): Promise<Summary[]> {
    const [rows] = await this.sql<[Row]>`
      SELECT started_at, public_id, device, runner, title, duration_ms, distance_m, elevation_m
      FROM runs WHERE started_at >= ${i64(from)}`;
    return rows.map(toSummary);
  }
}
