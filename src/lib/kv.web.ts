/**
 * Хранилище пробежек в браузере (iPhone).
 * localStorage в Safari вмещает всего ~5 МБ (это 12–15 часов бега с треком),
 * поэтому пробежки лежат в IndexedDB — там места в сотни раз больше.
 * Всё, что раньше было сохранено в localStorage, переезжает сюда само при первом чтении.
 */
const DB_NAME = 'run';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        const db = req.result;
        // Safari иногда закрывает соединение, пока приложение в фоне — тогда откроем заново
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
    // просим браузер не удалять данные, когда мало места
    try {
      navigator.storage?.persist?.().catch(() => {});
    } catch {}
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const attempt = async () => {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  try {
    return await attempt();
  } catch {
    dbPromise = null;
    return attempt();
  }
}

const hasIdb = () => typeof indexedDB !== 'undefined';

const legacy = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

export const kv = {
  async getItem(key: string): Promise<string | null> {
    if (!hasIdb()) return legacy.get(key);
    try {
      const v = await run<string | undefined>('readonly', (s) => s.get(key));
      if (v !== undefined) return v;
      // переезд из старого хранилища
      const old = legacy.get(key);
      if (old != null) {
        await run('readwrite', (s) => s.put(old, key));
        legacy.remove(key);
      }
      return old;
    } catch {
      return legacy.get(key);
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!hasIdb()) {
      localStorage.setItem(key, value);
      return;
    }
    await run('readwrite', (s) => s.put(value, key));
    legacy.remove(key);
  },
  async removeItem(key: string): Promise<void> {
    legacy.remove(key);
    if (hasIdb()) await run('readwrite', (s) => s.delete(key));
  },
};
