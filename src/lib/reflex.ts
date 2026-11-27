export const ATTEMPTS = 3;
export const MIN_DELAY_MS = 2000;
export const MAX_DELAY_MS = 6000;
export const PENALTY_MS = 1000;
export const MIN_HUMAN_MS = 100;
// The server measures reaction + network time itself. The client value may be lower than the
// server value by at most MAX_NETWORK_MS (network allowance), and never higher (except CLOCK_SLACK_MS).
export const MAX_NETWORK_MS = 250;
export const CLOCK_SLACK_MS = 50;

export function total(times: readonly number[]): number {
  return times.reduce((a, b) => a + b, 0);
}

export function average(times: readonly number[]): number {
  return times.length === 0 ? 0 : Math.round((total(times) / times.length) * 10) / 10;
}

export function formatMs(ms: number): string {
  return `${String(ms).replace(".", ",")} ms`;
}

export function reflexPrize(stake: number, cutPct: number): number {
  const pot = stake * 2;
  return pot - Math.ceil((pot * cutPct) / 100);
}
