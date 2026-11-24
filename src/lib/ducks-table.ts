export const RACE_SEGMENTS = 12;

export type Duck = { n: number; name: string; color: string };

export const DUCKS: readonly Duck[] = [
  { n: 1, name: "Pato Bravo", color: "#e10600" },
  { n: 2, name: "Pata Choca", color: "#0b3d91" },
  { n: 3, name: "O Marreco", color: "#0b6b3a" },
  { n: 4, name: "Patrício", color: "#c99a00" },
  { n: 5, name: "Grasna-Grasna", color: "#7a3db8" },
  { n: 6, name: "Pato à Ílhavo", color: "#141414" },
];

export function duckName(n: number): string {
  return DUCKS.find((d) => d.n === n)?.name ?? `Pato ${n}`;
}

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RacePlan = { duck: number; segmentTimes: number[]; total: number };

export function racePlan(seed: string, winner: number): RacePlan[] {
  const plans = DUCKS.map((d) => {
    const rand = seeded(`${seed}:${d.n}`);
    const segmentTimes = Array.from({ length: RACE_SEGMENTS }, () => 0.6 + rand() * 0.8);
    return { duck: d.n, segmentTimes, total: segmentTimes.reduce((a, b) => a + b, 0) };
  });
  const fastestOther = Math.min(...plans.filter((p) => p.duck !== winner).map((p) => p.total));
  return plans.map((p) => {
    if (p.duck !== winner || p.total < fastestOther) return p;
    const scale = (fastestOther * 0.97) / p.total;
    const segmentTimes = p.segmentTimes.map((t) => t * scale);
    return { ...p, segmentTimes, total: segmentTimes.reduce((a, b) => a + b, 0) };
  });
}

export function positionAt(plan: RacePlan, elapsed: number): number {
  let t = elapsed;
  for (let i = 0; i < plan.segmentTimes.length; i++) {
    const seg = plan.segmentTimes[i];
    if (t <= seg) return (i + t / seg) / plan.segmentTimes.length;
    t -= seg;
  }
  return 1;
}
