/** В браузере Health Connect нет */
export type HealthRun = {
  id: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  title: string | null;
  source: string;
  hasRoute: boolean;
  imported: boolean;
};
export const healthSupported = false;
export class HealthError extends Error {}
export async function connectHealth(): Promise<void> {
  throw new HealthError('Health Connect есть только в приложении на Android.');
}
export async function listHealthRuns(): Promise<HealthRun[]> {
  throw new HealthError('Health Connect есть только в приложении на Android.');
}
export async function importHealthRun(): Promise<string | null> {
  return null;
}
export function openHealthSettings() {}
