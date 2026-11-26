export const ATTEMPTS = 3;
export const MIN_DELAY_MS = 2000;
export const MAX_DELAY_MS = 6000;
export const PENALTY_MS = 1000;
export const MIN_HUMAN_MS = 100;

export function average(times: readonly number[]): number {
  return times.length === 0 ? 0 : Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

export function formatMs(ms: number): string {
  return `${ms} ms`;
}

export function reflexPrize(stake: number, cutPct: number): number {
  const pot = stake * 2;
  return pot - Math.ceil((pot * cutPct) / 100);
}
