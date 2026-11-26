"use server";

import { randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { gameClosed } from "@/lib/modules";
import { DECK_SIZE, beats, compound, hiloPayout, stepMultiplier, type Guess } from "@/lib/hilo";
import { activeHilo, toState, type HiloRow, type HiloState } from "@/lib/hilo-games";

export type HiloResult = { ok: true; game: HiloState; balance: number } | { ok: false; error: string };

async function balanceOf(userId: number): Promise<number> {
  return (await getBalances()).find((b) => b.user_id === userId)?.balance ?? 0;
}

export async function startHilo(stake: number): Promise<HiloResult> {
  const user = await requireUser();
  const closed = await gameClosed("altobaixo");
  if (closed) return { ok: false, error: closed };
  const R = await getRules();
  if (!Number.isInteger(stake) || stake < R.hiloMinBet || stake > R.hiloMaxBet) {
    return { ok: false, error: `A aposta tem de ser entre ${R.hiloMinBet} e ${R.hiloMaxBet} ☕.` };
  }
  if (await activeHilo(user.id)) return { ok: false, error: "Já tens uma mão a decorrer. Recarrega a página." };
  const balance = await balanceOf(user.id);
  if (balance < stake) return { ok: false, error: `Tens ${balance} ☕ e a aposta é de ${stake} ☕. O crupiê não aceita fiado.` };
  const first = randomInt(DECK_SIZE);
  const [row] = (await sql`
    WITH g AS (
      INSERT INTO hilo_games (user_id, stake, cards)
      SELECT ${user.id}, ${stake}, ARRAY[${first}::int]
      WHERE NOT EXISTS (SELECT 1 FROM hilo_games WHERE user_id = ${user.id} AND status = 'active')
      RETURNING id, stake, cards, multiplier, status, payout
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${-stake}, 'Alto ou Baixo: aposta', 'altobaixo' FROM g
    )
    SELECT * FROM g
  `) as HiloRow[];
  if (!row) return { ok: false, error: "Já tens uma mão a decorrer. Recarrega a página." };
  return { ok: true, game: toState(row), balance: balance - stake };
}

async function cashOut(userId: number, game: HiloState): Promise<HiloState | null> {
  const payout = hiloPayout(game.stake, game.multiplier);
  const [row] = (await sql`
    WITH g AS (
      UPDATE hilo_games SET status = 'cashed', payout = ${payout}, finished_at = now()
      WHERE id = ${game.id} AND user_id = ${userId} AND status = 'active' AND cardinality(cards) = ${game.cards.length}
      RETURNING id, stake, cards, multiplier, status, payout
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${userId}, payout, 'Alto ou Baixo: prémio ×' || replace(multiplier::text, '.', ','), 'altobaixo' FROM g WHERE payout > 0
    )
    SELECT * FROM g
  `) as HiloRow[];
  return row ? toState(row) : null;
}

export async function guessHilo(gameId: number, guess: Guess): Promise<HiloResult> {
  const user = await requireUser();
  if (guess !== "alto" && guess !== "baixo") return { ok: false, error: "Jogada inválida." };
  const R = await getRules();
  const game = await activeHilo(user.id);
  if (!game || game.id !== gameId) return { ok: false, error: "Esta mão já acabou. Recarrega a página." };
  const current = game.cards[game.cards.length - 1];
  const step = stepMultiplier(current, guess, R.hiloEdgePct);
  if (step === 0) return { ok: false, error: guess === "alto" ? "Não há carta mais alta do que um Rei." : "Não há carta mais baixa do que um Ás." };
  const next = randomInt(DECK_SIZE);
  const won = beats(current, next, guess);
  const multiplier = won ? Math.min(compound(game.multiplier, step), R.hiloMaxMult) : game.multiplier;
  const [row] = (await sql`
    UPDATE hilo_games
    SET cards = cards || ${next}::int, multiplier = ${multiplier},
      status = CASE WHEN ${won}::boolean THEN 'active' ELSE 'lost' END,
      finished_at = CASE WHEN ${won}::boolean THEN NULL ELSE now() END
    WHERE id = ${gameId} AND user_id = ${user.id} AND status = 'active' AND cardinality(cards) = ${game.cards.length}
    RETURNING id, stake, cards, multiplier, status, payout
  `) as HiloRow[];
  if (!row) return { ok: false, error: "A mesa mudou entretanto. Recarrega a página." };
  let state = toState(row);
  if (won && state.multiplier >= R.hiloMaxMult) state = (await cashOut(user.id, state)) ?? state;
  return { ok: true, game: state, balance: await balanceOf(user.id) };
}

export async function cashHilo(gameId: number): Promise<HiloResult> {
  const user = await requireUser();
  const game = await activeHilo(user.id);
  if (!game || game.id !== gameId) return { ok: false, error: "Esta mão já acabou. Recarrega a página." };
  if (game.cards.length < 2) return { ok: false, error: "Tens de acertar pelo menos uma carta antes de recolher." };
  const state = await cashOut(user.id, game);
  if (!state) return { ok: false, error: "A mesa mudou entretanto. Recarrega a página." };
  return { ok: true, game: state, balance: await balanceOf(user.id) };
}
