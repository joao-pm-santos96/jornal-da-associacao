export function grains(n: number): string {
  return n < 0 ? `−${-n}` : String(n);
}
