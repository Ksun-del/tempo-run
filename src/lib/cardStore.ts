/**
 * Черновики карточек в памяти: экран «Поделиться» и редактор стикеров работают с одной и той же карточкой.
 */
import { useSyncExternalStore } from 'react';
import { defaultComposition, type Composition } from '../components/card/model';

const drafts = new Map<string, Composition>();
const listeners = new Set<() => void>();

export function getDraft(runId: string): Composition {
  let c = drafts.get(runId);
  if (!c) {
    c = defaultComposition('story');
    drafts.set(runId, c);
  }
  return c;
}

export function setDraft(runId: string, next: Composition | ((c: Composition) => Composition)) {
  const cur = getDraft(runId);
  drafts.set(runId, typeof next === 'function' ? next(cur) : next);
  listeners.forEach((l) => l());
}

export function useDraft(runId: string): [Composition, (next: Composition | ((c: Composition) => Composition)) => void] {
  const comp = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => getDraft(runId),
  );
  return [comp, (next) => setDraft(runId, next)];
}
