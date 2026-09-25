/**
 * Итоги месяца и года: всё считается по списку пробежек.
 * Ключ периода: «2026» — год, «2026-09» — месяц.
 */
import { computeAchievements } from './achievements';
import type { Gender } from './gender';
import type { RunSummary } from './storage';

export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const DAYS_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

export type Period = { key: string; year: number; month: number | null; from: number; to: number };

export function parsePeriod(key: string): Period | null {
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : null;
  if (month != null && (month < 0 || month > 11)) return null;
  const from = new Date(year, month ?? 0, 1).getTime();
  const to = month == null ? new Date(year + 1, 0, 1).getTime() : new Date(year, month + 1, 1).getTime();
  return { key, year, month, from, to };
}

export const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

/** «сентябрь 2026» / «2026 год» */
export function periodTitle(p: Period, withYear = true) {
  if (p.month == null) return `${p.year} год`;
  const name = MONTHS[p.month];
  return withYear ? `${name} ${p.year}` : name;
}

/** Расстояния от Ростова — чтобы километры было с чем сравнить */
const PLACES: [number, string][] = [
  [42, 'марафон'],
  [45, 'как от Ростова до Новочеркасска'],
  [70, 'как от Ростова до Таганрога'],
  [140, 'как от Ростова до Таганрога и обратно'],
  [280, 'как от Ростова до Краснодара'],
  [470, 'как от Ростова до Волгограда'],
  [560, 'как от Ростова до Сочи'],
  [940, 'как от Ростова до Волгограда и обратно'],
  [1070, 'как от Ростова до Москвы'],
  [2140, 'как от Ростова до Москвы и обратно'],
  [3200, 'как от Ростова до Екатеринбурга'],
];

export function comparison(km: number): string | null {
  let best: string | null = null;
  for (const [d, text] of PLACES) if (km >= d) best = text;
  if (best === 'марафон') {
    const n = Math.floor(km / 42.195);
    return n === 1 ? 'больше, чем марафон' : `это ${n} ${n < 5 ? 'марафона' : 'марафонов'}`;
  }
  if (best) return best;
  if (km >= 21.1) return 'больше, чем полумарафон';
  if (km >= 10) return `это ${Math.floor(km / 5)} забега по 5 км`;
  return null;
}

export type Summary = {
  period: Period;
  runs: number;
  km: number;
  timeMs: number;
  pace: number | null;
  longestKm: number;
  best5k: number | null;
  best1k: number | null;
  /** 0 = воскресенье */
  favDay: number | null;
  favDayName: string;
  favDayShort: string;
  /** утро / день / вечер */
  favTime: string | null;
  activeDays: number;
  achievements: { id: string; name: string }[];
  /** км по месяцам (год) или по неделям (месяц) */
  bars: { label: string; km: number }[];
  /** на сколько процентов больше/меньше, чем в прошлом периоде */
  vsPrev: number | null;
};

function sumKm(list: RunSummary[]) {
  return list.reduce((a, r) => a + r.distanceM, 0) / 1000;
}

export function computeSummary(all: RunSummary[], p: Period, gender: Gender = 'f'): Summary {
  const list = all.filter((r) => r.startedAt >= p.from && r.startedAt < p.to);
  const km = sumKm(list);
  const timeMs = list.reduce((a, r) => a + r.durationMs, 0);

  let best5k: number | null = null;
  let best1k: number | null = null;
  for (const r of list) {
    if (r.splits.length >= 5 && (best5k == null || r.splits[4] < best5k)) best5k = r.splits[4];
    r.splits.forEach((at, i) => {
      const ms = at - (r.splits[i - 1] ?? 0);
      if (ms > 60000 && (best1k == null || ms < best1k)) best1k = ms;
    });
  }

  const byDay = new Array(7).fill(0);
  const byTime = { утро: 0, день: 0, вечер: 0 };
  const days = new Set<string>();
  for (const r of list) {
    const d = new Date(r.startedAt);
    byDay[d.getDay()] += 1;
    const h = d.getHours();
    byTime[h < 12 ? 'утро' : h < 18 ? 'день' : 'вечер'] += 1;
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  const maxDay = Math.max(...byDay);
  const favDay = maxDay > 0 ? byDay.indexOf(maxDay) : null;
  const favTimeEntry = Object.entries(byTime).sort((a, b) => b[1] - a[1])[0];
  const favTime = list.length ? favTimeEntry[0] : null;

  const achievements = computeAchievements(all, gender)
    .filter((a) => a.earnedAt != null && a.earnedAt >= p.from && a.earnedAt < p.to)
    .map((a) => ({ id: a.id, name: a.name }));

  let bars: { label: string; km: number }[];
  if (p.month == null) {
    bars = MONTHS.map((m, i) => ({
      label: m.slice(0, 1).toUpperCase(),
      km: sumKm(list.filter((r) => new Date(r.startedAt).getMonth() === i)),
    }));
  } else {
    // недели месяца: 1–7, 8–14, 15–21, 22–28, 29–конец
    const last = new Date(p.year, p.month + 1, 0).getDate();
    bars = [];
    for (let s = 1; s <= last; s += 7) {
      const e = Math.min(last, s + 6);
      bars.push({
        label: `${s}–${e}`,
        km: sumKm(list.filter((r) => {
          const d = new Date(r.startedAt).getDate();
          return d >= s && d <= e;
        })),
      });
    }
  }

  // прошлый период такой же длины
  const prev = p.month == null ? parsePeriod(String(p.year - 1)) : parsePeriod(monthKey(p.month === 0 ? p.year - 1 : p.year, p.month === 0 ? 11 : p.month - 1));
  const prevKm = prev ? sumKm(all.filter((r) => r.startedAt >= prev.from && r.startedAt < prev.to)) : 0;
  const vsPrev = prevKm >= 1 && km > 0 ? Math.round(((km - prevKm) / prevKm) * 100) : null;

  return {
    period: p,
    runs: list.length,
    km,
    timeMs,
    pace: km > 0.05 ? timeMs / 1000 / km : null,
    longestKm: Math.max(0, ...list.map((r) => r.distanceM / 1000)),
    best5k,
    best1k,
    favDay,
    favDayName: favDay != null ? DAYS[favDay] : '',
    favDayShort: favDay != null ? DAYS_SHORT[favDay] : '—',
    favTime,
    activeDays: days.size,
    achievements,
    bars,
    vsPrev,
  };
}

/** Периоды, за которые есть пробежки: сначала годы, потом месяцы (новые первыми) */
export function availablePeriods(all: RunSummary[]): { years: string[]; months: string[] } {
  const years = new Set<string>();
  const months = new Set<string>();
  for (const r of all) {
    const d = new Date(r.startedAt);
    years.add(String(d.getFullYear()));
    months.add(monthKey(d.getFullYear(), d.getMonth()));
  }
  const desc = (a: string, b: string) => (a < b ? 1 : -1);
  return { years: [...years].sort(desc), months: [...months].sort(desc) };
}

/** «в сентябре» */
export const monthPrep = (m: number) => MONTHS_PREP[m];
export const monthGen = (m: number) => MONTHS_GEN[m];
