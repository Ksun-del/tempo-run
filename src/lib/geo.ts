export type TrackPoint = {
  lat: number;
  lon: number;
  /** время точки, мс (unix) */
  t: number;
  alt?: number | null;
  /** номер отрезка: после паузы начинается новый, чтобы не рисовать прямую линию через паузу */
  seg: number;
};

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Расстояние между двумя точками в метрах (формула гаверсинусов). */
export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** 3725000 мс → "1:02:05", 325000 → "5:25" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${String(m).padStart(2, '0')}:${ss}`;
}

/** Темп в секундах на км. null, если дистанция слишком мала. */
export function paceSecPerKm(distanceM: number, durationMs: number): number | null {
  if (distanceM < 50 || durationMs <= 0) return null;
  return durationMs / 1000 / (distanceM / 1000);
}

/** 330 → "5'30\"" */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm > 60 * 60) return `–'––"`;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  if (s === 60) return `${m + 1}'00"`;
  return `${m}'${String(s).padStart(2, '0')}"`;
}

/** 5234 → "5,23" */
export function formatKm(m: number, digits = 2): string {
  return (m / 1000).toFixed(digits).replace('.', ',');
}

export function speedKmh(distanceM: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return distanceM / 1000 / (durationMs / 3600000);
}

/** Набор высоты по отрезкам, со сглаживанием шумного GPS. */
export function elevationGain(points: TrackPoint[]): number {
  let gain = 0;
  let ref: number | null = null;
  for (const p of points) {
    if (p.alt == null) continue;
    if (ref == null) {
      ref = p.alt;
      continue;
    }
    const d = p.alt - ref;
    if (d > 3) {
      gain += d;
      ref = p.alt;
    } else if (d < -3) {
      ref = p.alt;
    }
  }
  return Math.round(gain);
}

/** Разбивает точки на отрезки (по seg) для рисования. */
export function segments(points: TrackPoint[]): TrackPoint[][] {
  const out: TrackPoint[][] = [];
  let cur: TrackPoint[] = [];
  let seg = points[0]?.seg;
  for (const p of points) {
    if (p.seg !== seg) {
      if (cur.length) out.push(cur);
      cur = [];
      seg = p.seg;
    }
    cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Проецирует трек в прямоугольник width×height (Меркатор, с сохранением пропорций).
 * Возвращает SVG-пути для каждого отрезка.
 */
export function projectTrack(
  points: TrackPoint[],
  width: number,
  height: number,
  padding = 8,
): { paths: string[]; start?: [number, number]; end?: [number, number] } {
  if (points.length < 2) return { paths: [] };
  const merc = (p: TrackPoint): [number, number] => {
    const x = toRad(p.lon);
    const y = Math.log(Math.tan(Math.PI / 4 + toRad(p.lat) / 2));
    return [x, y];
  };
  const pts = points.map(merc);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const w = width - padding * 2;
  const h = height - padding * 2;
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min(w / spanX, h / spanY);
  const offX = padding + (w - spanX * scale) / 2;
  const offY = padding + (h - spanY * scale) / 2;
  const proj = ([x, y]: [number, number]): [number, number] => [
    offX + (x - minX) * scale,
    offY + (maxY - y) * scale,
  ];
  const projected = pts.map(proj);
  const paths: string[] = [];
  let d = '';
  let prevSeg = points[0].seg;
  projected.forEach(([x, y], i) => {
    const seg = points[i].seg;
    if (i === 0 || seg !== prevSeg) {
      if (d) paths.push(d);
      d = `M${x.toFixed(1)},${y.toFixed(1)}`;
      prevSeg = seg;
    } else {
      d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
  });
  if (d) paths.push(d);
  return { paths, start: projected[0], end: projected[projected.length - 1] };
}

/** Прореживает трек для отрисовки (оставляет каждую n-ю точку + последнюю). */
export function simplify(points: TrackPoint[], max = 600): TrackPoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    if (i % step === 0 || !prev || prev.seg !== p.seg || i === points.length - 1) out.push(p);
  }
  return out;
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 23.09.26 */
export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Утренняя пробежка", "Вечерняя пробежка"… */
export function defaultRunTitle(ts: number): string {
  const h = new Date(ts).getHours();
  if (h < 5) return 'Ночная пробежка';
  if (h < 12) return 'Утренняя пробежка';
  if (h < 17) return 'Дневная пробежка';
  if (h < 22) return 'Вечерняя пробежка';
  return 'Ночная пробежка';
}

export function weekdayName(ts: number): string {
  return WEEKDAYS[new Date(ts).getDay()];
}
