export const TABLE = { width: 1000, height: 500 } as const;
export const BALL_R = 11.25;
export const POCKETS: readonly { x: number; y: number; r: number }[] = [
  { x: 0, y: 0, r: 22 },
  { x: TABLE.width / 2, y: -4, r: 19 },
  { x: TABLE.width, y: 0, r: 22 },
  { x: 0, y: TABLE.height, r: 22 },
  { x: TABLE.width / 2, y: TABLE.height + 4, r: 19 },
  { x: TABLE.width, y: TABLE.height, r: 22 },
];
export const HEAD_SPOT = { x: TABLE.width * 0.25, y: TABLE.height / 2 };
export const FOOT_SPOT = { x: TABLE.width * 0.73, y: TABLE.height / 2 };
export const MAX_SPEED = 3.4;

const STEP_MS = 1;
export const FRAME_MS = 16;
const MAX_MS = 25_000;
const ROLLING_DECEL = 0.00018;
const BALL_RESTITUTION = 0.95;
const CUSHION_RESTITUTION = 0.78;

export type Ball = { id: number; x: number; y: number; vx: number; vy: number; pocketed: boolean };
export type Shot = { angle: number; power: number };
export type Frame = { t: number; pos: [number, number][] };
export type ShotEvent =
  | { t: number; kind: "hit"; a: number; b: number; speed: number }
  | { t: number; kind: "cushion"; ball: number; speed: number }
  | { t: number; kind: "pocket"; ball: number };
export type ShotResult = {
  balls: Ball[];
  frames: Frame[];
  events: ShotEvent[];
  firstContact: number | null;
  pocketed: number[];
  durationMs: number;
};

export function isStripe(id: number): boolean {
  return id >= 9;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function rack(random: () => number = Math.random): Ball[] {
  const solids = shuffle([1, 2, 3, 4, 5, 6, 7], random);
  const stripes = shuffle([9, 10, 11, 12, 13, 14, 15], random);
  const backLeft = random() < 0.5;
  const corner1 = (backLeft ? solids : stripes).pop()!;
  const corner2 = (backLeft ? stripes : solids).pop()!;
  const rest = shuffle([...solids, ...stripes], random);
  const gap = 0.02;
  const dx = (BALL_R * 2 + gap) * Math.cos(Math.PI / 6);
  const balls: Ball[] = [{ id: 0, x: HEAD_SPOT.x, y: HEAD_SPOT.y, vx: 0, vy: 0, pocketed: false }];
  for (let row = 0; row < 5; row++) {
    for (let j = 0; j <= row; j++) {
      let id: number;
      if (row === 2 && j === 1) id = 8;
      else if (row === 4 && j === 0) id = corner1;
      else if (row === 4 && j === 4) id = corner2;
      else id = rest.pop()!;
      balls.push({
        id,
        x: FOOT_SPOT.x + row * dx,
        y: FOOT_SPOT.y + (j - row / 2) * (BALL_R * 2 + gap),
        vx: 0,
        vy: 0,
        pocketed: false,
      });
    }
  }
  return balls;
}

export function isFree(balls: readonly Ball[], x: number, y: number, ignore: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < BALL_R || x > TABLE.width - BALL_R || y < BALL_R || y > TABLE.height - BALL_R) return false;
  if (POCKETS.some((p) => Math.hypot(x - p.x, y - p.y) < p.r + BALL_R)) return false;
  return balls.every((b) => b.id === ignore || b.pocketed || Math.hypot(b.x - x, b.y - y) >= BALL_R * 2);
}

export function canPlaceCue(balls: readonly Ball[], x: number, y: number): boolean {
  return isFree(balls, x, y, 0);
}

export function freeSpot(balls: readonly Ball[], x: number, y: number, ignore: number): { x: number; y: number } {
  for (let step = 0; step < 400; step++) {
    const dx = (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * (BALL_R / 2);
    if (isFree(balls, x + dx, y, ignore)) return { x: x + dx, y };
  }
  for (let gy = BALL_R * 2; gy < TABLE.height; gy += BALL_R * 2) {
    for (let gx = BALL_R * 2; gx < TABLE.width; gx += BALL_R * 2) if (isFree(balls, gx, gy, ignore)) return { x: gx, y: gy };
  }
  return { x, y };
}

function snapshot(balls: readonly Ball[], t: number): Frame {
  const r = (n: number) => Math.round(n * 10) / 10;
  return { t, pos: balls.map((b) => (b.pocketed ? [-100, -100] : [r(b.x), r(b.y)])) };
}

export function simulate(start: readonly Ball[], shot: Shot, frameMs: number = FRAME_MS): ShotResult {
  const balls = start.map((b) => ({ ...b, vx: 0, vy: 0 }));
  const cue = balls.find((b) => b.id === 0 && !b.pocketed);
  const frames: Frame[] = [snapshot(balls, 0)];
  const events: ShotEvent[] = [];
  const pocketed: number[] = [];
  let firstContact: number | null = null;
  if (!cue) return { balls, frames, events, firstContact, pocketed, durationMs: 0 };
  const speed = Math.max(0, Math.min(1, shot.power)) * MAX_SPEED;
  cue.vx = Math.cos(shot.angle) * speed;
  cue.vy = Math.sin(shot.angle) * speed;

  let t = 0;
  while (t < MAX_MS) {
    t += STEP_MS;
    let moving = false;
    for (const b of balls) {
      if (b.pocketed) continue;
      const v = Math.hypot(b.vx, b.vy);
      if (v === 0) continue;
      const slowed = v - ROLLING_DECEL * STEP_MS;
      if (slowed <= 0) {
        b.vx = 0;
        b.vy = 0;
        continue;
      }
      b.vx *= slowed / v;
      b.vy *= slowed / v;
      b.x += b.vx * STEP_MS;
      b.y += b.vy * STEP_MS;
      moving = true;
    }

    for (const b of balls) {
      if (b.pocketed) continue;
      const pocket = POCKETS.find((p) => Math.hypot(b.x - p.x, b.y - p.y) < p.r);
      if (pocket) {
        b.pocketed = true;
        b.vx = 0;
        b.vy = 0;
        pocketed.push(b.id);
        events.push({ t, kind: "pocket", ball: b.id });
      }
    }

    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.pocketed) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= BALL_R * 2 || dist === 0) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = BALL_R * 2 - dist;
        a.x -= (nx * overlap) / 2;
        a.y -= (ny * overlap) / 2;
        b.x += (nx * overlap) / 2;
        b.y += (ny * overlap) / 2;
        const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (approach <= 0) continue;
        const impulse = (approach * (1 + BALL_RESTITUTION)) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
        if (firstContact === null && (a.id === 0 || b.id === 0)) firstContact = a.id === 0 ? b.id : a.id;
        events.push({ t, kind: "hit", a: a.id, b: b.id, speed: approach });
        moving = true;
      }
    }

    for (const b of balls) {
      if (b.pocketed) continue;
      let hit = 0;
      if (b.x < BALL_R) {
        b.x = BALL_R + (BALL_R - b.x);
        hit = Math.abs(b.vx);
        b.vx = Math.abs(b.vx) * CUSHION_RESTITUTION;
        b.vy *= CUSHION_RESTITUTION;
      } else if (b.x > TABLE.width - BALL_R) {
        b.x = TABLE.width - BALL_R - (b.x - (TABLE.width - BALL_R));
        hit = Math.abs(b.vx);
        b.vx = -Math.abs(b.vx) * CUSHION_RESTITUTION;
        b.vy *= CUSHION_RESTITUTION;
      }
      if (b.y < BALL_R) {
        b.y = BALL_R + (BALL_R - b.y);
        hit = Math.max(hit, Math.abs(b.vy));
        b.vy = Math.abs(b.vy) * CUSHION_RESTITUTION;
        b.vx *= CUSHION_RESTITUTION;
      } else if (b.y > TABLE.height - BALL_R) {
        b.y = TABLE.height - BALL_R - (b.y - (TABLE.height - BALL_R));
        hit = Math.max(hit, Math.abs(b.vy));
        b.vy = -Math.abs(b.vy) * CUSHION_RESTITUTION;
        b.vx *= CUSHION_RESTITUTION;
      }
      if (hit > 0.05) events.push({ t, kind: "cushion", ball: b.id, speed: hit });
    }

    if (t % frameMs === 0) frames.push(snapshot(balls, t));
    if (!moving) break;
  }
  frames.push(snapshot(balls, t));
  for (const b of balls) {
    b.vx = 0;
    b.vy = 0;
  }
  return { balls, frames, events, firstContact, pocketed, durationMs: t };
}

export type AimGuide = { cueEnd: { x: number; y: number }; target: { id: number; x: number; y: number; dirX: number; dirY: number } | null };

export function aimGuide(balls: readonly Ball[], angle: number): AimGuide | null {
  const cue = balls.find((b) => b.id === 0 && !b.pocketed);
  if (!cue) return null;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = Infinity;
  let hit: Ball | null = null;
  for (const b of balls) {
    if (b.id === 0 || b.pocketed) continue;
    const fx = b.x - cue.x;
    const fy = b.y - cue.y;
    const along = fx * dx + fy * dy;
    if (along <= 0) continue;
    const perp2 = fx * fx + fy * fy - along * along;
    const reach = (BALL_R * 2) ** 2 - perp2;
    if (reach < 0) continue;
    const d = along - Math.sqrt(reach);
    if (d < best) {
      best = d;
      hit = b;
    }
  }
  const tx = dx > 0 ? (TABLE.width - BALL_R - cue.x) / dx : dx < 0 ? (BALL_R - cue.x) / dx : Infinity;
  const ty = dy > 0 ? (TABLE.height - BALL_R - cue.y) / dy : dy < 0 ? (BALL_R - cue.y) / dy : Infinity;
  const wall = Math.min(tx, ty);
  if (!hit || best > wall) return { cueEnd: { x: cue.x + dx * wall, y: cue.y + dy * wall }, target: null };
  const gx = cue.x + dx * best;
  const gy = cue.y + dy * best;
  const nx = (hit.x - gx) / (BALL_R * 2);
  const ny = (hit.y - gy) / (BALL_R * 2);
  return { cueEnd: { x: gx, y: gy }, target: { id: hit.id, x: hit.x, y: hit.y, dirX: nx, dirY: ny } };
}
