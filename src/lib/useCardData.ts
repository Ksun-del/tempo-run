import { useEffect, useMemo, useState } from 'react';
import type { CardData } from '../components/card/model';
import { paceSecPerKm } from './geo';
import { splitRows } from './splits';
import { getRun, getSettings, type Run } from './storage';

/** Пробежка + имя из настроек → данные для карточки */
export function useCardData(id: string) {
  const [run, setRun] = useState<Run | null>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    getRun(id).then(setRun);
    getSettings().then((s) => setName(s.name));
  }, [id]);
  const data: CardData | null = useMemo(
    () =>
      run && {
        title: run.title,
        startedAt: run.startedAt,
        distanceM: run.distanceM,
        durationMs: run.durationMs,
        pace: paceSecPerKm(run.distanceM, run.durationMs),
        elevationGainM: run.elevationGainM,
        points: run.points,
        splits: splitRows(run),
        name,
      },
    [run, name],
  );
  return { run, data };
}
