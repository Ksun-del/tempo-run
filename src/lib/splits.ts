import { formatKm } from './geo';
import type { Run } from './storage';

/** Строки таблицы сплитов: время и темп каждого километра + остаток. */
export function splitRows(run: Run) {
  const rows: { km: string; ms: number; pace: number }[] = [];
  run.splits.forEach((at, i) => {
    const ms = at - (run.splits[i - 1] ?? 0);
    rows.push({ km: String(i + 1), ms, pace: ms / 1000 });
  });
  const restM = run.distanceM - run.splits.length * 1000;
  if (restM > 50) {
    const ms = run.durationMs - (run.splits[run.splits.length - 1] ?? 0);
    rows.push({ km: formatKm(restM, 2), ms, pace: ms / 1000 / (restM / 1000) });
  }
  return rows;
}
