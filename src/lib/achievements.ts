/**
 * Достижения. Считаются заново по всем пробежкам — ничего дополнительно хранить не нужно.
 * Время — по часам телефона (в Ростове это ростовское время).
 */
import { fill, type Gender } from './gender';
import type { RunSummary } from './storage';

export type BadgeShape = 'circle' | 'hex' | 'shield' | 'round' | 'star';
export type BadgeIcon = 'shoe' | 'club' | 'trophy' | 'fire' | 'sun' | 'moon' | 'rain' | 'snow' | 'flower' | 'pumpkin';

export type AchievementDef = {
  id: string;
  group: string;
  name: string;
  desc: string;
  shape: BadgeShape;
  big?: string;
  small?: string;
  icon?: BadgeIcon;
  secret?: boolean;
  repeat?: boolean;
};

export type AchievementState = AchievementDef & {
  earnedAt: number | null;
  /** сколько раз получено (для повторяемых) */
  count: number;
  /** прогресс 0..1 к получению */
  progress: number;
  progressText?: string;
};

const G = {
  first: 'Первые шаги',
  dist: 'Дистанция за одну пробежку',
  total: 'Всего набегано',
  reg: 'Регулярность',
  days: 'Дни и время',
  hol: 'Праздники',
};

const DIST: [string, number, string, string, boolean?][] = [
  ['d5', 5000, '5', 'Первые 5 км'],
  ['d10', 10000, '10', 'Первые 10 км'],
  ['d15', 15000, '15', 'Первые 15 км'],
  ['d21', 21097, '21,1', 'Полумарафон'],
  ['d30', 30000, '30', 'Первые 30 км'],
  ['d42', 42195, '42,2', 'Марафон'],
  ['d50', 50000, '50', 'Ультра', true],
];
const TOTAL: [string, number, string][] = [
  ['t50', 50, 'Всего с RUN'],
  ['t100', 100, 'Сотка!'],
  ['t250', 250, 'Как от Ростова до Краснодара'],
  ['t500', 500, 'Всего с RUN'],
  ['t1000', 1000, 'Почти до Москвы'],
  ['t2000', 2000, 'Легенда клуба'],
];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_run', group: G.first, name: 'Первая пробежка', desc: 'Первая пробежка, записанная в RUN', shape: 'circle', icon: 'shoe' },
  { id: 'club', group: G.first, name: 'В клубе', desc: 'Отправил{а} первую пробежку в ленту клуба', shape: 'circle', icon: 'club' },
  { id: 'first_pr', group: G.first, name: 'Первый рекорд', desc: 'Побил{а} свой лучший 1 км или 5 км', shape: 'circle', icon: 'trophy' },
  ...DIST.map(([id, m, big, name, secret]) => ({
    id,
    group: G.dist,
    name,
    desc: secret ? `${big} км за одну пробежку` : `${big} км за одну пробежку`,
    shape: 'circle' as const,
    big,
    small: 'КМ',
    secret,
  })),
  ...TOTAL.map(([id, km, desc]) => ({ id, group: G.total, name: `Ты пробежал{а} ${km} км`, desc, shape: 'hex' as const, big: String(km), small: 'КМ' })),
  { id: 'n10', group: G.reg, name: '10 пробежек', desc: 'Всего 10 пробежек', shape: 'shield', big: '10', small: 'РАЗ' },
  { id: 'n50', group: G.reg, name: '50 пробежек', desc: 'Всего 50 пробежек', shape: 'shield', big: '50', small: 'РАЗ' },
  { id: 'n100', group: G.reg, name: '100 пробежек', desc: 'Всего 100 пробежек', shape: 'shield', big: '100', small: 'РАЗ' },
  { id: 'week3', group: G.reg, name: 'Неделя в ритме', desc: '3 пробежки за одну неделю', shape: 'shield', big: '3×', small: 'НЕДЕЛЯ' },
  { id: 'month4', group: G.reg, name: 'Месяц без пропусков', desc: 'Бегал{а} каждую неделю 4 недели подряд', shape: 'shield', icon: 'fire' },
  { id: 'weekend', group: G.days, name: 'Воскресный забег', desc: 'Пробежка в субботу или воскресенье', shape: 'round', big: 'ВС', small: 'SUNDAY RUN', repeat: true },
  { id: 'dawn', group: G.days, name: 'Рассветный бегун', desc: 'Старт до 7:00', shape: 'round', icon: 'sun', repeat: true },
  { id: 'night', group: G.days, name: 'Ночной дозор', desc: 'Старт после 22:00', shape: 'round', icon: 'moon', repeat: true },
  { id: 'winter', group: G.days, name: 'В любую погоду', desc: 'Пробежка с ноября по февраль. Считаем зимы', shape: 'round', icon: 'rain', repeat: true },
  { id: 'midnight', group: G.days, name: 'После полуночи', desc: 'Старт между 0:00 и 5:00', shape: 'round', icon: 'moon', secret: true },
  { id: 'jan1', group: G.hol, name: 'Первая пробежка года', desc: 'Пробежка 1 января', shape: 'star', big: '1.01' },
  { id: 'dec31', group: G.hol, name: 'Последняя пробежка года', desc: 'Пробежка 31 декабря', shape: 'star', icon: 'snow' },
  { id: 'spring', group: G.hol, name: 'Весна пришла', desc: 'Пробежка 1 марта', shape: 'star', icon: 'flower' },
  { id: 'may9', group: G.hol, name: 'Забег Победы', desc: 'Пробежка 9 мая', shape: 'star', big: '9', small: 'МАЯ' },
  { id: 'halloween', group: G.hol, name: 'Страшно быстро', desc: 'Пробежка на Хеллоуин, 31 октября', shape: 'star', icon: 'pumpkin' },
];

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

const weekStart = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const WEEK = 7 * 86400000;

/** Пересчитать все достижения по списку пробежек */
export function computeAchievements(all: RunSummary[], gender: Gender = 'f'): AchievementState[] {
  const runs = [...all].sort((a, b) => a.startedAt - b.startedAt);
  const earned = new Map<string, number>();
  const count = new Map<string, number>();
  const give = (id: string, at: number) => {
    if (!earned.has(id)) earned.set(id, at);
    count.set(id, (count.get(id) ?? 0) + 1);
  };

  let total = 0;
  let best1: number | null = null;
  let best5: number | null = null;
  let longest = 0;
  const weeks = new Map<number, number>();
  const winters = new Set<number>();

  runs.forEach((r, i) => {
    const t = r.startedAt;
    const d = new Date(t);
    const h = d.getHours();
    const dow = d.getDay();
    const mon = d.getMonth();
    const day = d.getDate();

    if (i === 0) give('first_run', t);
    if (r.clubSharedAt && !earned.has('club')) give('club', r.clubSharedAt);

    // рекорды: лучший километр и 5 км лучше, чем во всех прошлых пробежках
    const km1 = r.splits.reduce<number | null>((best, at, j) => {
      const ms = at - (r.splits[j - 1] ?? 0);
      return ms > 60000 && (best == null || ms < best) ? ms : best;
    }, null);
    const km5 = r.splits.length >= 5 ? r.splits[4] : null;
    if ((km1 != null && best1 != null && km1 < best1) || (km5 != null && best5 != null && km5 < best5)) give('first_pr', t);
    if (km1 != null && (best1 == null || km1 < best1)) best1 = km1;
    if (km5 != null && (best5 == null || km5 < best5)) best5 = km5;

    for (const [id, m] of DIST) if (r.distanceM >= m * 0.995 && !earned.has(id)) give(id, t);
    longest = Math.max(longest, r.distanceM);

    const before = total;
    total += r.distanceM / 1000;
    for (const [id, km] of TOTAL) if (before < km && total >= km) give(id, t);

    const n = i + 1;
    if (n === 10) give('n10', t);
    if (n === 50) give('n50', t);
    if (n === 100) give('n100', t);

    const w = weekStart(t);
    const inWeek = (weeks.get(w) ?? 0) + 1;
    weeks.set(w, inWeek);
    if (inWeek === 3) give('week3', t);
    if (!earned.has('month4') && [1, 2, 3].every((k) => weeks.has(w - k * WEEK))) give('month4', t);

    if (dow === 0 || dow === 6) give('weekend', t);
    if (h >= 5 && h < 7) give('dawn', t);
    if (h >= 22) give('night', t);
    if (h < 5) give('midnight', t);
    // одна зима = ноябрь–февраль; за зиму значок засчитывается один раз
    if (mon === 10 || mon === 11 || mon === 0 || mon === 1) {
      const season = mon >= 10 ? d.getFullYear() : d.getFullYear() - 1;
      if (!winters.has(season)) {
        winters.add(season);
        give('winter', t);
      }
    }
    if (mon === 0 && day === 1) give('jan1', t);
    if (mon === 11 && day === 31) give('dec31', t);
    if (mon === 2 && day === 1) give('spring', t);
    if (mon === 4 && day === 9) give('may9', t);
    if (mon === 9 && day === 31) give('halloween', t);
  });

  const nRuns = runs.length;
  return ACHIEVEMENTS.map((a) => {
    let progress = earned.has(a.id) ? 1 : 0;
    let progressText: string | undefined;
    const dist = DIST.find((x) => x[0] === a.id);
    const tot = TOTAL.find((x) => x[0] === a.id);
    if (!earned.has(a.id)) {
      if (dist) {
        progress = Math.min(1, longest / dist[1]);
        progressText = `Самая длинная: ${(longest / 1000).toFixed(1).replace('.', ',')} из ${dist[2]} км`;
      } else if (tot) {
        progress = Math.min(1, total / tot[1]);
        progressText = `${Math.floor(total)} из ${tot[1]} км`;
      } else if (/^n\d+$/.test(a.id)) {
        const goal = Number(a.id.slice(1));
        progress = Math.min(1, nRuns / goal);
        progressText = `${nRuns} из ${goal} пробежек`;
      }
    }
    return {
      ...a,
      name: fill(a.name, gender),
      desc: fill(a.desc, gender),
      earnedAt: earned.get(a.id) ?? null,
      count: count.get(a.id) ?? 0,
      progress,
      progressText,
    };
  });
}

/** Какие достижения появились благодаря пробежке runId (сравниваем «до» и «после») */
export function newAchievementsFor(all: RunSummary[], runId: string, gender: Gender = 'f'): AchievementState[] {
  const run = all.find((r) => r.id === runId);
  if (!run) return [];
  const without = all.filter((r) => r.id !== runId);
  const before = new Map(computeAchievements(without).map((a) => [a.id, a.count]));
  return computeAchievements(all, gender).filter((a) => {
    const was = before.get(a.id) ?? 0;
    // повторяемые показываем только в первый раз, чтобы не надоедать
    return a.count > 0 && was === 0;
  });
}
