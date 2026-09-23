import { defaultRunTitle, haversine, type TrackPoint } from './geo';
import { saveRun, type Run } from './storage';

/**
 * Создаёт демо-пробежку (петля ~6 км: набережная Дона и Большая Садовая в Ростове),
 * чтобы можно было посмотреть историю и шаблоны карточек без реального бега.
 */
export async function addDemoRun(): Promise<Run> {
  const way: [number, number][] = [
    [47.2178, 39.6960], [47.2181, 39.7040], [47.2186, 39.7120], [47.2191, 39.7200], [47.2195, 39.7270],
    [47.2220, 39.7268], [47.2245, 39.7265], [47.2238, 39.7180], [47.2232, 39.7100], [47.2227, 39.7020],
    [47.2224, 39.6960], [47.2200, 39.6958], [47.2178, 39.6960],
  ];
  const start = Date.now() - 2 * 3600 * 1000;
  const pts: TrackPoint[] = [];
  let t = start;
  let dist = 0;
  const splits: number[] = [];
  for (let i = 0; i < way.length - 1; i++) {
    const [aLat, aLon] = way[i];
    const [bLat, bLon] = way[i + 1];
    const steps = 30;
    for (let s = 0; s < steps; s++) {
      const f = s / steps;
      const lat = aLat + (bLat - aLat) * f + (Math.random() - 0.5) * 0.00004;
      const lon = aLon + (bLon - aLon) * f + (Math.random() - 0.5) * 0.00004;
      const prev = pts[pts.length - 1];
      if (prev) {
        const d = haversine(prev.lat, prev.lon, lat, lon);
        const pace = 320 + 25 * Math.sin(i / 2) + (Math.random() - 0.5) * 20; // сек/км
        const dt = (d / 1000) * pace * 1000;
        const before = dist;
        dist += d;
        t += dt;
        while (dist >= (splits.length + 1) * 1000) {
          const target = (splits.length + 1) * 1000;
          splits.push(t - dt + ((target - before) / d) * dt - start);
        }
      }
      pts.push({ lat, lon, t, alt: 140 + 12 * Math.sin(pts.length / 40), seg: 0 });
    }
  }
  const run: Run = {
    id: `demo-${start}`,
    title: defaultRunTitle(start),
    startedAt: start,
    endedAt: t,
    durationMs: t - start,
    distanceM: dist,
    elevationGainM: 38,
    splits,
    points: pts,
  };
  await saveRun(run);
  return run;
}
