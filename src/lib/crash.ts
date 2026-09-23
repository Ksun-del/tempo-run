/**
 * Запоминает последнюю фатальную JS-ошибку, чтобы при следующем запуске
 * показать её (и можно было прислать скриншот для починки).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tempo:last-crash';

type Handler = (error: unknown, isFatal?: boolean) => void;
const EU = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void } }).ErrorUtils;

if (EU) {
  const prev = EU.getGlobalHandler();
  EU.setGlobalHandler((error, isFatal) => {
    const e = error as { message?: string; stack?: string };
    const text = `${e?.message ?? String(error)}\n${(e?.stack ?? '').split('\n').slice(0, 6).join('\n')}`;
    if (isFatal) {
      AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), text }))
        .catch(() => {})
        .finally(() => setTimeout(() => prev(error, isFatal), 300));
    } else {
      prev(error, isFatal);
    }
  });
}

export async function takeLastCrash(): Promise<{ at: number; text: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
