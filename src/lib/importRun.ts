/**
 * Пробежки не из RUN: файл GPX (часы, Strava) и Health Connect.
 */
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { defaultRunTitle, elevationGain, haversine, type TrackPoint } from './geo';
import { getRun, saveRun, type Run } from './storage';

/** Отметки каждого километра (мс от старта) по точкам трека */
export function splitsFromPoints(points: TrackPoint[]): { splits: number[]; distanceM: number } {
  const splits: number[] = [];
  let dist = 0;
  const t0 = points[0]?.t ?? 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const d = haversine(a.lat, a.lon, b.lat, b.lon);
    if (d > 500) continue; // скачок GPS
    const before = dist;
    dist += d;
    while (Math.floor(dist / 1000) > splits.length) {
      const mark = (splits.length + 1) * 1000;
      const frac = d > 0 ? (mark - before) / d : 1;
      splits.push(Math.round(a.t - t0 + frac * (b.t - a.t)));
    }
  }
  return { splits, distanceM: dist };
}

/** Разбор GPX: точки trkpt с lat/lon/ele/time */
export function parseGpx(xml: string): { name: string | null; points: TrackPoint[] } {
  const name = xml.match(/<name>\s*(?:<!\[CDATA\[)?([^<\]]+)/i)?.[1]?.trim() ?? null;
  const points: TrackPoint[] = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/gi;
  let seg = 0;
  let m: RegExpExecArray | null;
  // номера отрезков: каждый <trkseg> — новый отрезок
  const segStarts: number[] = [];
  const segRe = /<trkseg\b/gi;
  let sm: RegExpExecArray | null;
  while ((sm = segRe.exec(xml))) segStarts.push(sm.index);
  while ((m = re.exec(xml))) {
    const attrs = m[1] ?? m[3] ?? '';
    const body = m[2] ?? '';
    const lat = Number(attrs.match(/lat\s*=\s*["']([^"']+)/i)?.[1]);
    const lon = Number(attrs.match(/lon\s*=\s*["']([^"']+)/i)?.[1]);
    const time = body.match(/<time>([^<]+)<\/time>/i)?.[1];
    const ele = body.match(/<ele>([^<]+)<\/ele>/i)?.[1];
    const t = time ? Date.parse(time) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(t)) continue;
    while (seg + 1 < segStarts.length && m.index > segStarts[seg + 1]) seg++;
    points.push({ lat, lon, t, alt: ele ? Number(ele) : null, seg });
  }
  points.sort((a, b) => a.t - b.t);
  return { name, points };
}

/** Собрать пробежку из точек и сохранить. Возвращает id или null, если такая уже есть. */
export async function saveImported(opts: {
  id: string;
  title?: string | null;
  points: TrackPoint[];
  startedAt?: number;
  endedAt?: number;
  distanceM?: number;
}): Promise<string | null> {
  if (await getRun(opts.id)) return null;
  const pts = opts.points;
  const fromTrack = pts.length > 1 ? splitsFromPoints(pts) : { splits: [], distanceM: 0 };
  const startedAt = opts.startedAt ?? pts[0]?.t ?? Date.now();
  const endedAt = opts.endedAt ?? pts[pts.length - 1]?.t ?? startedAt;
  const distanceM = opts.distanceM && opts.distanceM > 0 ? opts.distanceM : fromTrack.distanceM;
  const run: Run = {
    id: opts.id,
    title: opts.title?.trim() || defaultRunTitle(startedAt),
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - startedAt),
    distanceM,
    elevationGainM: elevationGain(pts),
    splits: fromTrack.splits,
    points: pts,
    clubSharedAt: null,
  };
  await saveRun(run);
  return run.id;
}

export class ImportError extends Error {}

/** Выбрать GPX-файл и добавить пробежку */
export async function importGpxFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const xml = await new File(asset.uri).text();
  if (!/<gpx\b/i.test(xml)) throw new ImportError('Это не GPX-файл. Выгрузи тренировку из часов или Strava в формате GPX.');
  const { name, points } = parseGpx(xml);
  if (points.length < 2) throw new ImportError('В файле нет точек маршрута со временем.');
  const id = `gpx-${points[0].t}`;
  const saved = await saveImported({ id, title: name, points });
  if (!saved) throw new ImportError('Эта пробежка уже есть в приложении.');
  return saved;
}
