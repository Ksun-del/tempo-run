import * as Speech from 'expo-speech';

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function spokenDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${plural(h, 'час', 'часа', 'часов')}`);
  if (m) parts.push(`${m} ${plural(m, 'минута', 'минуты', 'минут')}`);
  if (s || parts.length === 0) parts.push(`${s} ${plural(s, 'секунда', 'секунды', 'секунд')}`);
  return parts.join(' ');
}

function spokenKm(km: number): string {
  if (Number.isInteger(km)) return `${km} ${plural(km, 'километр', 'километра', 'километров')}`;
  const [a, b] = km.toFixed(2).split('.');
  return `${a} и ${Number(b)} сотых километра`;
}

export function say(text: string) {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'ru-RU', rate: 1.0, pitch: 1.0 });
  } catch {
    // голос недоступен — просто молчим
  }
}

export function announceSplit(km: number, totalMs: number, lastKmMs: number) {
  say(
    `${spokenKm(km)}. Время ${spokenDuration(totalMs)}. ` +
      `Последний километр за ${spokenDuration(lastKmMs)}.`,
  );
}

export function announceFinish(distanceM: number, durationMs: number) {
  const km = Math.round(distanceM / 10) / 100;
  const pace = distanceM > 50 ? (durationMs / (distanceM / 1000)) : 0;
  say(
    `Тренировка завершена. ${spokenKm(km)} за ${spokenDuration(durationMs)}.` +
      (pace ? ` Средний темп ${spokenDuration(pace)} на километр.` : ''),
  );
}
