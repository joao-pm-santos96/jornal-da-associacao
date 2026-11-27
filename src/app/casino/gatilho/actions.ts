"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser, type User } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { field, type FormState } from "@/lib/form";
import { getRules, type Rules } from "@/lib/rules";
import { pushToUsers } from "@/lib/push";
import { gameClosed } from "@/lib/modules";
import { ATTEMPTS, CLOCK_SLACK_MS, MAX_DELAY_MS, MAX_NETWORK_MS, MIN_DELAY_MS, MIN_HUMAN_MS, PENALTY_MS, average, formatMs, reflexPrize, total } from "@/lib/reflex";
import { getReflexGame, timesOf, type ReflexGame } from "@/lib/reflex-games";

async function balanceOf(userId: number): Promise<number> {
  return (await getBalances()).find((b) => b.user_id === userId)?.balance ?? 0;
}

function refresh(id?: number): void {
  revalidatePath("/casino/gatilho");
  if (id) revalidatePath(`/casino/gatilho/${id}`);
}

export async function challengeReflex(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const closed = await gameClosed("gatilho");
  if (closed) return { error: closed };
  const R = await getRules();
  const opponentId = Number(field(form, "opponent_id"));
  const stake = Number(field(form, "stake") || "0");
  if (!Number.isInteger(opponentId) || opponentId <= 0 || opponentId === user.id) return { error: "Escolhe outro sócio para desafiar." };
  if (!Number.isInteger(stake) || stake < R.reflexMinStake) return { error: `A aposta mínima é de ${R.reflexMinStake} ☕.` };
  if (stake > 0 && (await balanceOf(user.id)) < stake) return { error: "Não tens grãos para essa aposta." };
  const [row] = (await sql`
    WITH o AS (
      SELECT id, name FROM users WHERE id = ${opponentId}
        AND NOT EXISTS (
          SELECT 1 FROM reflex_games WHERE status IN ('pending', 'active')
            AND ((challenger_id = ${user.id} AND opponent_id = ${opponentId}) OR (challenger_id = ${opponentId} AND opponent_id = ${user.id}))
        )
    ),
    g AS (
      INSERT INTO reflex_games (challenger_id, opponent_id, stake)
      SELECT ${user.id}, o.id, ${stake} FROM o
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${user.id}, ${-stake}, 'Gatilho n.º ' || g.id || ': aposta contra ' || o.name FROM g, o WHERE ${stake} > 0
    )
    SELECT g.id, o.name FROM g, o
  `) as { id: number; name: string }[];
  if (!row) return { error: "Já há um desafio pendente ou a decorrer contra esse sócio." };
  after(() =>
    pushToUsers([opponentId], {
      title: `⚡ ${user.name} desafiou-te para o Gatilho`,
      body: `${stake > 0 ? `${stake} ☕ em jogo. ` : "Partida amigável. "}Tens ${R.reflexAcceptHours} horas para aceitar.`,
      url: "/casino/gatilho",
      tag: `gatilho-${row.id}`,
    }),
  );
  refresh();
  return { ok: `Desafio enviado a ${row.name}.` };
}

export async function respondReflex(gameId: number, accept: boolean): Promise<void> {
  const user = await requireUser();
  const R = await getRules();
  const game = await getReflexGame(gameId);
  if (!game || game.status !== "pending" || game.opponent_id !== user.id) return;
  if (!accept) {
    const [row] = (await sql`
      WITH g AS (
        UPDATE reflex_games SET status = 'declined', updated_at = now(), finished_at = now()
        WHERE id = ${gameId} AND status = 'pending' AND opponent_id = ${user.id}
        RETURNING id, challenger_id, stake
      ),
      r AS (
        INSERT INTO ledger (user_id, amount, reason)
        SELECT challenger_id, stake, 'Gatilho n.º ' || id || ': recusado, devolução' FROM g WHERE stake > 0
      )
      SELECT challenger_id FROM g
    `) as { challenger_id: number }[];
    if (row) {
      after(() =>
        pushToUsers([row.challenger_id], {
          title: `🐔 ${user.name} recusou o Gatilho`,
          body: game.stake > 0 ? "Os grãos voltaram para ti." : "Fica para a próxima.",
          url: "/casino/gatilho",
          tag: `gatilho-${gameId}`,
        }),
      );
    }
    refresh(gameId);
    return;
  }
  if (await gameClosed("gatilho")) return;
  if (game.stake > 0 && (await balanceOf(user.id)) < game.stake) return;
  const [row] = (await sql`
    WITH g AS (
      UPDATE reflex_games
      SET status = 'active', turn_id = challenger_id, updated_at = now(),
        deadline_at = now() + make_interval(hours => ${R.reflexTurnHours})
      WHERE id = ${gameId} AND status = 'pending' AND opponent_id = ${user.id}
      RETURNING id, challenger_id, stake
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${user.id}, -stake, 'Gatilho n.º ' || id || ': aposta contra ' || ${game.challenger} FROM g WHERE stake > 0
    )
    SELECT challenger_id FROM g
  `) as { challenger_id: number }[];
  if (row) {
    after(() =>
      pushToUsers([row.challenger_id], {
        title: `⚡ ${user.name} aceitou o Gatilho`,
        body: "Tu jogas primeiro. Três tentativas, ganha a melhor média.",
        url: `/casino/gatilho/${gameId}`,
        tag: `gatilho-${gameId}`,
      }),
    );
  }
  refresh(gameId);
  redirect(`/casino/gatilho/${gameId}`);
}

export async function cancelReflex(gameId: number): Promise<void> {
  const user = await requireUser();
  await sql`
    WITH g AS (
      UPDATE reflex_games SET status = 'cancelled', updated_at = now(), finished_at = now()
      WHERE id = ${gameId} AND status = 'pending' AND challenger_id = ${user.id}
      RETURNING id, challenger_id, stake
    )
    INSERT INTO ledger (user_id, amount, reason)
    SELECT challenger_id, stake, 'Gatilho n.º ' || id || ': cancelado, devolução' FROM g WHERE stake > 0
  `;
  refresh(gameId);
}

export type ReflexOutcome = { winnerId: number | null; myAvg: number; rivalAvg: number; prize: number };
export type AttemptResult =
  | { ok: true; ms: number; note: string | null; times: number[]; turnDone: boolean; outcome: ReflexOutcome | null }
  | { ok: false; error: string };
export type StartResult =
  | { ok: true; delayMs: number; abandoned: number | null; times: number[] }
  | { ok: false; error: string; turnDone?: boolean };

async function finishGame(game: ReflexGame, R: Rules): Promise<ReflexOutcome | null> {
  const cAvg = average(game.challenger_times);
  const oAvg = average(game.opponent_times);
  const cTotal = total(game.challenger_times);
  const oTotal = total(game.opponent_times);
  const winnerId = cTotal === oTotal ? null : cTotal < oTotal ? game.challenger_id : game.opponent_id;
  const prize = reflexPrize(game.stake, R.reflexHouseCutPct);
  const [row] = (await sql`
    WITH g AS (
      UPDATE reflex_games
      SET status = 'finished', finished_at = now(), updated_at = now(), deadline_at = NULL, turn_id = NULL,
        winner_id = ${winnerId}::int, finish_reason = ${winnerId === null ? "empate" : null}
      WHERE id = ${game.id} AND status = 'active' AND cardinality(challenger_times) = ${ATTEMPTS} AND cardinality(opponent_times) = ${ATTEMPTS}
      RETURNING id, challenger_id, opponent_id, stake
    ),
    p AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${winnerId}::int, ${prize}::int, 'Gatilho n.º ' || id || ': vitória' FROM g WHERE ${winnerId}::int IS NOT NULL AND stake > 0
      UNION ALL
      SELECT challenger_id, stake, 'Gatilho n.º ' || id || ': empate, devolução' FROM g WHERE ${winnerId}::int IS NULL AND stake > 0
      UNION ALL
      SELECT opponent_id, stake, 'Gatilho n.º ' || id || ': empate, devolução' FROM g WHERE ${winnerId}::int IS NULL AND stake > 0
    )
    SELECT id FROM g
  `) as { id: number }[];
  if (!row) return null;
  return { winnerId, myAvg: oAvg, rivalAvg: cAvg, prize };
}

async function recordTime(user: User, game: ReflexGame, ms: number, R: Rules): Promise<{ game: ReflexGame; turnDone: boolean; outcome: ReflexOutcome | null } | null> {
  const before = timesOf(game, user.id).length;
  const [row] = (await sql`
    UPDATE reflex_games
    SET challenger_times = CASE WHEN challenger_id = ${user.id} THEN challenger_times || ${ms}::int ELSE challenger_times END,
      opponent_times = CASE WHEN opponent_id = ${user.id} THEN opponent_times || ${ms}::int ELSE opponent_times END,
      attempt_issued_at = NULL, attempt_delay_ms = NULL, updated_at = now()
    WHERE id = ${game.id} AND status = 'active' AND turn_id = ${user.id}
      AND cardinality(CASE WHEN challenger_id = ${user.id} THEN challenger_times ELSE opponent_times END) = ${before}
    RETURNING id
  `) as { id: number }[];
  if (!row) return null;
  const updated = await getReflexGame(game.id);
  if (!updated) return null;
  if (timesOf(updated, user.id).length < ATTEMPTS) return { game: updated, turnDone: false, outcome: null };

  if (user.id === updated.challenger_id) {
    const [moved] = (await sql`
      UPDATE reflex_games SET turn_id = opponent_id, updated_at = now(), deadline_at = now() + make_interval(hours => ${R.reflexTurnHours})
      WHERE id = ${game.id} AND status = 'active' AND turn_id = ${user.id} AND cardinality(challenger_times) = ${ATTEMPTS}
      RETURNING opponent_id
    `) as { opponent_id: number }[];
    if (moved) {
      after(() =>
        pushToUsers([moved.opponent_id], {
          title: "⚡ É a tua vez no Gatilho",
          body: `${user.name} já jogou. Agora és tu: três tentativas.`,
          url: `/casino/gatilho/${game.id}`,
          tag: `gatilho-${game.id}`,
        }),
      );
    }
    return { game: updated, turnDone: true, outcome: null };
  }

  const outcome = await finishGame(updated, R);
  if (outcome) {
    const rivalId = updated.challenger_id;
    const line = `${updated.challenger} ${formatMs(average(updated.challenger_times))} · ${updated.opponent} ${formatMs(average(updated.opponent_times))}`;
    const prizeText = updated.stake > 0 ? ` +${outcome.prize} ☕` : "";
    after(() =>
      pushToUsers([rivalId], {
        title: outcome.winnerId === null ? "⚡ Gatilho empatado" : outcome.winnerId === rivalId ? `⚡ Ganhaste o Gatilho a ${user.name}!` : `⚡ ${user.name} ganhou o Gatilho`,
        body: `${line}${outcome.winnerId === rivalId ? prizeText : ""}`,
        url: `/casino/gatilho/${game.id}`,
        tag: `gatilho-${game.id}`,
      }),
    );
  }
  return { game: updated, turnDone: true, outcome };
}

async function myActiveGame(gameId: number, userId: number): Promise<ReflexGame | string> {
  const game = await getReflexGame(gameId);
  if (!game || game.status !== "active") return "Esta partida já não está a decorrer.";
  if (game.turn_id !== userId) return "Não é a tua vez.";
  return game;
}

export async function startAttempt(gameId: number): Promise<StartResult> {
  const user = await requireUser();
  const R = await getRules();
  let game = await myActiveGame(gameId, user.id);
  if (typeof game === "string") return { ok: false, error: game };
  let abandoned: number | null = null;
  if (game.attempt_open) {
    const recorded = await recordTime(user, game, PENALTY_MS, R);
    if (!recorded) return { ok: false, error: "A mesa mudou entretanto. Recarrega a página." };
    abandoned = PENALTY_MS;
    if (recorded.turnDone) {
      refresh(gameId);
      return { ok: false, error: "A tentativa que deixaste a meio contou como falhada e a tua vez acabou.", turnDone: true };
    }
    game = recorded.game;
  }
  const delayMs = MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  const [row] = (await sql`
    UPDATE reflex_games SET attempt_issued_at = clock_timestamp(), attempt_delay_ms = ${delayMs}, updated_at = now()
    WHERE id = ${gameId} AND status = 'active' AND turn_id = ${user.id} AND attempt_issued_at IS NULL
    RETURNING id
  `) as { id: number }[];
  if (!row) return { ok: false, error: "A mesa mudou entretanto. Recarrega a página." };
  return { ok: true, delayMs, abandoned, times: timesOf(game, user.id) };
}

export async function finishAttempt(gameId: number, reported: number | null): Promise<AttemptResult> {
  // Timed before auth and lookups so server work does not count against the player.
  const [timing] = (await sql`
    SELECT (extract(epoch FROM clock_timestamp() - attempt_issued_at) * 1000)::int AS elapsed, attempt_delay_ms AS delay
    FROM reflex_games WHERE id = ${gameId} AND attempt_issued_at IS NOT NULL
  `) as { elapsed: number; delay: number }[];
  const user = await requireUser();
  const R = await getRules();
  const game = await myActiveGame(gameId, user.id);
  if (typeof game === "string") return { ok: false, error: game };
  if (!timing) return { ok: false, error: "Não há nenhuma tentativa a decorrer." };

  let ms: number;
  let note: string | null = null;
  if (reported === null || !Number.isFinite(reported)) {
    ms = PENALTY_MS;
    note = "Partida antecipada!";
  } else if (reported < MIN_HUMAN_MS) {
    ms = PENALTY_MS;
    note = "Rápido demais para ser humano. Conta como partida antecipada.";
  } else if (timing.elapsed < timing.delay) {
    ms = PENALTY_MS;
    note = "Tocaste antes do verde.";
  } else if (reported > timing.elapsed - timing.delay + CLOCK_SLACK_MS) {
    // The pad cannot measure more time than the server saw pass.
    ms = PENALTY_MS;
    note = "Resultado inválido. Conta como 1 segundo.";
  } else {
    const serverMs = timing.elapsed - timing.delay;
    ms = Math.min(Math.max(Math.round(reported), serverMs - MAX_NETWORK_MS), PENALTY_MS);
    if (ms === PENALTY_MS) note = "Demasiado lento: conta como 1 segundo.";
  }

  const recorded = await recordTime(user, game, ms, R);
  if (!recorded) return { ok: false, error: "A mesa mudou entretanto. Recarrega a página." };
  if (recorded.turnDone) refresh(gameId);
  return { ok: true, ms, note, times: timesOf(recorded.game, user.id), turnDone: recorded.turnDone, outcome: recorded.outcome };
}
