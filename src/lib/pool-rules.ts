import { FOOT_SPOT, HEAD_SPOT, freeSpot, type Ball, type ShotResult } from "./pool";

export type Group = "lisas" | "riscadas";
export type Seat = 0 | 1;

export type PoolState = {
  balls: Ball[];
  turn: Seat;
  groups: [Group | null, Group | null];
  ballInHand: boolean;
  broken: boolean;
  winner: Seat | null;
};

export type Verdict = { state: PoolState; foul: string | null; summary: string; keepsTurn: boolean };

export function groupOf(id: number): Group | null {
  if (id >= 1 && id <= 7) return "lisas";
  if (id >= 9 && id <= 15) return "riscadas";
  return null;
}

function other(group: Group): Group {
  return group === "lisas" ? "riscadas" : "lisas";
}

export function remaining(balls: readonly Ball[], group: Group): number[] {
  return balls.filter((b) => !b.pocketed && groupOf(b.id) === group).map((b) => b.id);
}

export function onTheEight(state: PoolState, seat: Seat): boolean {
  const group = state.groups[seat];
  return group !== null && remaining(state.balls, group).length === 0;
}

export function initialState(balls: Ball[]): PoolState {
  return { balls, turn: 0, groups: [null, null], ballInHand: false, broken: false, winner: null };
}

function listBalls(ids: number[]): string {
  if (ids.length === 1) return `a ${ids[0]}`;
  return `a ${ids.slice(0, -1).join(", a ")} e a ${ids[ids.length - 1]}`;
}

export function judge(before: PoolState, result: ShotResult): Verdict {
  const seat = before.turn;
  const rival: Seat = seat === 0 ? 1 : 0;
  const potted = result.pocketed;
  const objects = potted.filter((id) => id !== 0);
  const scratch = potted.includes(0);
  const eight = potted.includes(8);
  const mine = before.groups[seat];
  const onEight = onTheEight(before, seat);

  let foul: string | null = null;
  if (scratch) foul = "a branca foi ao buraco";
  else if (result.firstContact === null) foul = "a branca não tocou em nenhuma bola";
  else if (before.broken) {
    if (mine === null && result.firstContact === 8) foul = "tocou primeiro na preta";
    else if (mine !== null && onEight && result.firstContact !== 8) foul = "tinha de tocar primeiro na preta";
    else if (mine !== null && !onEight && groupOf(result.firstContact) !== mine) foul = `tocou primeiro numa bola das ${other(mine)}`;
  }

  let balls = result.balls.map((b) => ({ ...b, vx: 0, vy: 0 }));
  const groups: [Group | null, Group | null] = [before.groups[0], before.groups[1]];
  const parts: string[] = [];
  const coloured = objects.filter((id) => id !== 8);
  if (coloured.length > 0) parts.push(`Meteu ${listBalls(coloured)}.`);

  if (eight && before.broken) {
    const won = onEight && foul === null;
    parts.push(won ? "🎱 Meteu a preta no fim: ganhou a partida!" : `🎱 Meteu a preta ${foul ? `com falta (${foul})` : "antes de tempo"}: perdeu a partida.`);
    return {
      state: { balls, turn: seat, groups, ballInHand: false, broken: true, winner: won ? seat : rival },
      foul,
      summary: parts.join(" "),
      keepsTurn: false,
    };
  }

  if (eight) {
    const spot = freeSpot(balls, FOOT_SPOT.x, FOOT_SPOT.y, 8);
    balls = balls.map((b) => (b.id === 8 ? { ...b, ...spot, pocketed: false } : b));
    parts.push("A preta entrou na abertura e voltou à mesa.");
  }

  if (before.broken && mine === null && foul === null) {
    const first = objects.find((id) => groupOf(id) !== null);
    const group = first === undefined ? null : groupOf(first);
    if (group) {
      groups[seat] = group;
      groups[rival] = other(group);
      parts.push(`Fica com as ${group}.`);
    }
  }

  const target = groups[seat];
  const scored = target ? objects.some((id) => groupOf(id) === target) : objects.some((id) => id !== 8);
  const keepsTurn = foul === null && scored;

  if (foul) {
    const cue = balls.find((b) => b.id === 0);
    const spot = cue && !cue.pocketed ? { x: cue.x, y: cue.y } : freeSpot(balls, HEAD_SPOT.x, HEAD_SPOT.y, 0);
    balls = balls.map((b) => (b.id === 0 ? { ...b, ...spot, pocketed: false } : b));
    parts.push(`Falta: ${foul}. O adversário fica com a branca na mão.`);
  } else if (keepsTurn) parts.push("Continua a jogar.");
  else parts.push(objects.length === 0 ? "Nada entrou. Passa a vez." : "Passa a vez.");

  return {
    state: { balls, turn: keepsTurn ? seat : rival, groups, ballInHand: foul !== null, broken: true, winner: null },
    foul,
    summary: parts.join(" "),
    keepsTurn,
  };
}
