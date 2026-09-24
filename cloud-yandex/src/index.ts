/**
 * Точка входа Yandex Cloud Function (обработчик: index.handler).
 * Переменные окружения: CLUB_CODE — код клуба, YDB_ENDPOINT — строка подключения к базе YDB.
 * Путь запроса передаётся в параметре ?path=/api/... (у функции один адрес).
 */
import { randomUUID } from 'node:crypto';
import { handle, type Req } from './app';
import { YdbStore } from './ydbStore';

let store: YdbStore | null = null;

type Event = {
  httpMethod?: string;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};
type Context = { token?: { access_token?: string } };

const reply = (status: number, body: unknown) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,x-club-code,x-device-id',
  },
  body: JSON.stringify(body),
  isBase64Encoded: false,
});

export async function handler(event: Event, context: Context) {
  const method = (event.httpMethod ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') return reply(204, null);

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.headers ?? {})) headers[k.toLowerCase()] = String(v);
  const qs = { ...(event.queryStringParameters ?? {}) };
  const path = qs.path ?? '/';
  delete qs.path;
  const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : '';
  const req: Req = { method, path, query: qs, headers, body };

  const endpoint = process.env.YDB_ENDPOINT;
  if (!endpoint) return reply(503, { error: 'на сервере не указана база (YDB_ENDPOINT)' });
  const token = context?.token?.access_token;
  if (!token) return reply(503, { error: 'у функции не выбран сервисный аккаунт' });

  try {
    if (!store) store = new YdbStore(endpoint, token);
    store.setToken(token);
    try {
      await store.init();
    } catch (e) {
      // драйвер запоминает неудачное подключение — в следующий раз создаём заново
      store.close();
      store = null;
      throw e;
    }
    const res = await handle(req, store, process.env.CLUB_CODE, randomUUID);
    return reply(res.status, res.body);
  } catch (e) {
    console.error(e);
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return reply(500, { error: 'ошибка базы, попробуй ещё раз', detail: detail.slice(0, 500), token: `${token.slice(0, 4)}…(${token.length})` });
  }
}
