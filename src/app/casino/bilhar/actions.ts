"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { field, type FormState } from "@/lib/form";
import { getRules } from "@/lib/rules";
import { pushToUsers } from "@/lib/push";
import { gameClosed } from "@/lib/modules";
import { isFree, rack, simulate, type Ball, type Frame, type ShotEvent } from "@/lib/pool";
import { initialState, judge, type PoolState } from "@/lib/pool-rules";
import { getPoolGame, poolPrize, type LastShot } from "@/lib/pool-games";

const SHOT_FRAME_MS = 32;

async function balanceOf(userId: number): Promise<number> {
  return (await getBalances()).find((b) => b.user_id === userId)?.balance ?? 0;
}

function refresh(id?: number): void {
  revalidatePath("/casino/bilhar");
  if (id) revalidatePath(`/casino/bilhar/${id}`);
}

export async function challengePool(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const closed = await gameClosed("bilhar");
  if (closed) return { error: closed };
  const R = await getRules();
  const opponentId = Number(field(form, "opponent_id"));
  const stake = Number(field(form, "stake") || "0");
  if (!Number.isInteger(opponentId) || opponentId <= 0 || opponentId === user.id) return { error: "Escolhe outro sócio para desafiar." };
  if (!Number.isInteger(stake) || stake < R.poolMinStake) return { error: `A aposta mínima é de ${R.poolMinStake} ☕.` };
  if (stake > 0 && (await balanceOf(user.id)) < stake) return { error: "Não tens grãos para essa aposta." };
  const [row] = (await sql`
    WITH o AS (
      SELECT id, name FROM users WHERE id = ${opponentId}
        AND NOT EXISTS (
          SELECT 1 FROM pool_games WHERE status IN ('pending', 'active')
            AND ((challenger_id = ${user.id} AND opponent_id = ${opponentId}) OR (challenger_id = ${opponentId} AND opponent_id = ${user.id}))
        )
    ),
    g AS (
      INSERT INTO pool_games (challenger_id, opponent_id, stake)
      SELECT ${user.id}, o.id, ${stake} FROM o
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${user.id}, ${-stake}, 'Bilhar n.º ' || g.id || ': aposta contra ' || o.name FROM g, o WHERE ${stake} > 0
    )
    SELECT g.id, o.name FROM g, o
  `) as { id: number; name: string }[];
  if (!row) return { error: "Já há uma partida pendente ou a decorrer contra esse sócio." };
  after(() =>
    pushToUsers([opponentId], {
      title: `🎱 ${user.name} desafiou-te para uma partida de bilhar`,
      body: `${stake > 0 ? `${stake} ☕ em jogo. ` : "Partida amigável. "}Tens ${R.poolAcceptHours} horas para aceitar.`,
      url: "/casino/bilhar",
      tag: `bilhar-${row.id}`,
    }),
  );
  refresh();
  return { ok: `Desafio enviado a ${row.name}.` };
}

export async function respondPool(gameId: number, accept: boolean): Promise<void> {
  const user = await requireUser();
  const R = await getRules();
  const game = await getPoolGame(gameId);
  if (!game || game.status !== "pending" || game.opponent_id !== user.id) return;
  if (!accept) {
    const [row] = (await sql`
      WITH g AS (
        UPDATE pool_games SET status = 'declined', updated_at = now(), finished_at = now()
        WHERE id = ${gameId} AND status = 'pending' AND opponent_id = ${user.id}
        RETURNING id, challenger_id, stake
      ),
      r AS (
        INSERT INTO ledger (user_id, amount, reason)
        SELECT challenger_id, stake, 'Bilhar n.º ' || id || ': recusado, devolução' FROM g WHERE stake > 0
      )
      SELECT challenger_id FROM g
    `) as { challenger_id: number }[];
    if (row) {
      after(() =>
        pushToUsers([row.challenger_id], {
          title: `🐔 ${user.name} recusou a partida de bilhar`,
          body: game.stake > 0 ? "Os grãos voltaram para ti." : "Fica para a próxima.",
          url: "/casino/bilhar",
          tag: `bilhar-${gameId}`,
        }),
      );
    }
    refresh(gameId);
    return;
  }
  if (await gameClosed("bilhar")) return;
  if (game.stake > 0 && (await balanceOf(user.id)) < game.stake) return;
  const state = initialState(rack());
  const [row] = (await sql`
    WITH g AS (
      UPDATE pool_games
      SET status = 'active', state = ${JSON.stringify(state)}::jsonb, turn_id = challenger_id, updated_at = now(),
        deadline_at = now() + make_interval(hours => ${R.poolTurnHours})
      WHERE id = ${gameId} AND status = 'pending' AND opponent_id = ${user.id}
      RETURNING id, challenger_id, stake
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${user.id}, -stake, 'Bilhar n.º ' || id || ': aposta contra ' || ${game.challenger} FROM g WHERE stake > 0
    )
    SELECT challenger_id FROM g
  `) as { challenger_id: number }[];
  if (row) {
    after(() =>
      pushToUsers([row.challenger_id], {
        title: `🎱 ${user.name} aceitou a partida`,
        body: "Tu abres. A mesa está arrumada à tua espera.",
        url: `/casino/bilhar/${gameId}`,
        tag: `bilhar-${gameId}`,
      }),
    );
  }
  refresh(gameId);
  redirect(`/casino/bilhar/${gameId}`);
}

export async function cancelPool(gameId: number): Promise<void> {
  const user = await requireUser();
  await sql`
    WITH g AS (
      UPDATE pool_games SET status = 'cancelled', updated_at = now(), finished_at = now()
      WHERE id = ${gameId} AND status = 'pending' AND challenger_id = ${user.id}
      RETURNING id, challenger_id, stake
    )
    INSERT INTO ledger (user_id, amount, reason)
    SELECT challenger_id, stake, 'Bilhar n.º ' || id || ': cancelado, devolução' FROM g WHERE stake > 0
  `;
  refresh(gameId);
}

export type Playback = { n: number; frameMs: number; frames: Frame[]; events: ShotEvent[]; balls: Ball[]; summary: string };
export type ShootResult = { ok: true; playback: Playback; finished: boolean } | { ok: false; error: string };

export async function shootPool(
  gameId: number,
  expectedShots: number,
  shot: { angle: number; power: number },
  cue: { x: number; y: number } | null,
): Promise<ShootResult> {
  const user = await requireUser();
  const R = await getRules();
  const game = await getPoolGame(gameId);
  if (!game || game.status !== "active" || !game.state) return { ok: false, error: "Esta partida já não está a decorrer." };
  if (game.turn_id !== user.id) return { ok: false, error: "Não é a tua vez." };
  if (game.shots !== expectedShots) return { ok: false, error: "A mesa mudou entretanto. Recarrega a página." };
  if (!Number.isFinite(shot.angle) || !Number.isFinite(shot.power) || shot.power < 0.05 || shot.power > 1) {
    return { ok: false, error: "Tacada inválida." };
  }
  const state: PoolState = game.state;
  let balls = state.balls;
  if (state.ballInHand) {
    if (!cue || !isFree(balls, cue.x, cue.y, 0)) return { ok: false, error: "Põe a branca num sítio livre da mesa antes de tacar." };
    balls = balls.map((b) => (b.id === 0 ? { ...b, x: cue.x, y: cue.y, pocketed: false } : b));
  }
  const seat = state.turn;
  const players = [game.challenger_id, game.opponent_id];
  const result = simulate(balls, shot, SHOT_FRAME_MS);
  const verdict = judge({ ...state, balls }, result);
  const next = verdict.state;
  const winnerId = next.winner === null ? null : players[next.winner];
  const finished = winnerId !== null;
  const nextTurn = players[next.turn];
  const n = game.shots + 1;
  const lastShot: LastShot = { n, by: user.id, frameMs: SHOT_FRAME_MS, frames: result.frames, events: result.events, summary: verdict.summary };
  const prize = poolPrize(game.stake, R.poolHouseCutPct);

  const [row] = (await sql`
    WITH g AS (
      UPDATE pool_games
      SET state = ${JSON.stringify(next)}::jsonb, shots = ${n}, last_shot = ${JSON.stringify(lastShot)}::jsonb, updated_at = now(),
        turn_id = ${winnerId === null ? nextTurn : null},
        deadline_at = CASE WHEN ${finished}::boolean THEN NULL ELSE now() + make_interval(hours => ${R.poolTurnHours}) END,
        status = CASE WHEN ${finished}::boolean THEN 'finished' ELSE 'active' END,
        winner_id = ${winnerId}, finish_reason = CASE WHEN ${finished}::boolean THEN 'preta' END,
        finished_at = CASE WHEN ${finished}::boolean THEN now() END
      WHERE id = ${gameId} AND status = 'active' AND shots = ${game.shots} AND turn_id = ${user.id}
      RETURNING id, stake
    ),
    p AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${winnerId}::int, ${prize}::int, 'Bilhar n.º ' || id || ': vitória' FROM g WHERE ${winnerId}::int IS NOT NULL AND stake > 0
    )
    SELECT id FROM g
  `) as { id: number }[];
  if (!row) return { ok: false, error: "A mesa mudou entretanto. Recarrega a página." };

  const rivalId = players[seat === 0 ? 1 : 0];
  if (winnerId !== null) {
    const won = winnerId === user.id;
    after(() =>
      pushToUsers([rivalId], {
        title: won ? `🎱 ${user.name} ganhou a partida` : `🎱 Ganhaste a partida a ${user.name}!`,
        body: `${user.name}: ${verdict.summary}${!won && game.stake > 0 ? ` +${prize} ☕` : ""}`,
        url: `/casino/bilhar/${gameId}`,
        tag: `bilhar-${gameId}`,
      }),
    );
  } else if (nextTurn !== user.id) {
    after(() =>
      pushToUsers([nextTurn], {
        title: "🎱 É a tua vez no bilhar",
        body: `${user.name}: ${verdict.summary}`,
        url: `/casino/bilhar/${gameId}`,
        tag: `bilhar-${gameId}`,
      }),
    );
  }
  return {
    ok: true,
    finished: winnerId !== null,
    playback: { n, frameMs: SHOT_FRAME_MS, frames: result.frames, events: result.events, balls: next.balls, summary: verdict.summary },
  };
}

export async function forfeitPool(gameId: number): Promise<void> {
  const user = await requireUser();
  const R = await getRules();
  const [row] = (await sql`
    WITH g AS (
      UPDATE pool_games
      SET status = 'finished', finish_reason = 'desistencia', finished_at = now(), updated_at = now(), deadline_at = NULL, turn_id = NULL,
        winner_id = CASE WHEN challenger_id = ${user.id} THEN opponent_id ELSE challenger_id END
      WHERE id = ${gameId} AND status = 'active' AND (challenger_id = ${user.id} OR opponent_id = ${user.id})
      RETURNING id, winner_id, stake
    ),
    p AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT winner_id, (stake * 2 - ceil(stake * 2 * ${R.poolHouseCutPct}::numeric / 100))::int, 'Bilhar n.º ' || id || ': vitória por desistência'
      FROM g WHERE stake > 0
    )
    SELECT winner_id, stake FROM g
  `) as { winner_id: number; stake: number }[];
  if (row) {
    after(() =>
      pushToUsers([row.winner_id], {
        title: `🏳️ ${user.name} desistiu da partida de bilhar`,
        body: row.stake > 0 ? `Ganhaste por desistência. +${poolPrize(row.stake, R.poolHouseCutPct)} ☕` : "Ganhaste por desistência.",
        url: `/casino/bilhar/${gameId}`,
        tag: `bilhar-${gameId}`,
      }),
    );
  }
  refresh(gameId);
}
