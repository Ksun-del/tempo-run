import { useEffect, useState } from 'react';
import { getActive, subscribe, type ActiveRun } from './tracker';
import { getSettings, listRuns, onRunsChanged, onSettingsChanged, type RunSummary, type Settings } from './storage';

/** Текущая активная тренировка; перерисовывается на каждую новую точку. */
export function useActiveRun(): ActiveRun | null {
  const [, force] = useState(0);
  const [run, setRun] = useState<ActiveRun | null>(getActive());
  useEffect(
    () =>
      subscribe((s) => {
        setRun(s);
        force((n) => n + 1);
      }),
    [],
  );
  return run;
}

/** Тикает раз в `ms` — для секундомера. */
export function useNow(ms = 1000, enabled = true): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}

export function useRuns(): { runs: RunSummary[]; loading: boolean } {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = () =>
      listRuns().then((r) => {
        if (alive) {
          setRuns(r);
          setLoading(false);
        }
      });
    load();
    const off = onRunsChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { runs, loading };
}

/** Настройки; обновляются сразу после сохранения на экране настроек */
export function useSettings(): Settings | null {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    let alive = true;
    getSettings().then((x) => alive && setS(x));
    const off = onSettingsChanged(setS);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return s;
}
