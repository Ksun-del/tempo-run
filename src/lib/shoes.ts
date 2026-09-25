/** Кроссовки: несколько пар, пробег считается по пробежкам, в которых они выбраны */
import { useEffect, useState } from 'react';
import { kv } from './kv';
import type { RunSummary } from './storage';

export type Shoe = {
  id: string;
  name: string;
  /** сколько уже было набегано до RUN, км */
  startKm: number;
  /** после скольких км пора менять */
  limitKm: number;
  createdAt: number;
  retired?: boolean;
};

const KEY = 'tempo:shoes';
export const DEFAULT_LIMIT_KM = 700;

const listeners = new Set<(s: Shoe[]) => void>();

export async function listShoes(): Promise<Shoe[]> {
  try {
    const raw = await kv.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function write(list: Shoe[]) {
  await kv.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l(list));
}

export async function addShoe(name: string, startKm: number, limitKm = DEFAULT_LIMIT_KM): Promise<Shoe> {
  const shoe: Shoe = { id: `sh${Date.now().toString(36)}`, name: name.trim() || 'Кроссовки', startKm: Math.max(0, startKm), limitKm, createdAt: Date.now() };
  await write([...(await listShoes()), shoe]);
  return shoe;
}

export async function updateShoe(id: string, patch: Partial<Shoe>) {
  await write((await listShoes()).map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export async function deleteShoe(id: string) {
  await write((await listShoes()).filter((s) => s.id !== id));
}

/** Пробег пары, км */
export function shoeKm(shoe: Shoe, runs: RunSummary[]): number {
  return shoe.startKm + runs.filter((r) => r.shoeId === shoe.id).reduce((a, r) => a + r.distanceM, 0) / 1000;
}

export type ShoeState = 'ok' | 'soon' | 'worn';
export function shoeState(km: number, limitKm: number): ShoeState {
  if (km >= limitKm) return 'worn';
  if (km >= limitKm * 0.85) return 'soon';
  return 'ok';
}

export function useShoes(): Shoe[] {
  const [list, setList] = useState<Shoe[]>([]);
  useEffect(() => {
    let alive = true;
    listShoes().then((l) => alive && setList(l));
    listeners.add(setList);
    return () => {
      alive = false;
      listeners.delete(setList);
    };
  }, []);
  return list;
}
