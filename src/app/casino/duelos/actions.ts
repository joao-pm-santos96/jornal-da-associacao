"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { field, type FormState } from "@/lib/form";
import { duelPrize, isMove, moveEmoji, outcome, type Move } from "@/lib/duels-table";
import { getRules } from "@/lib/rules";
import { pushToUsers } from "@/lib/push";
import { gameClosed } from "@/lib/modules";

async function balanceOf(userId: number): Promise<number> {
  return (await getBalances()).find((b) => b.user_id === userId)?.balance ?? 0;
}

export async function challenge(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const closed = await gameClosed("duelos");
  if (closed) return { error: closed };
  const R = await getRules();
  const opponentId = Number(field(form, "opponent_id"));
  const stake = Number(field(form, "stake"));
  const move = field(form, "move");
  if (!Number.isInteger(opponentId) || opponentId === user.id) return { error: "Escolhe outro sócio para desafiar." };
  if (!isMove(move)) return { error: "Escolhe pedra, papel ou tesoura." };
  if (!Number.isInteger(stake) || stake < R.duelMinStake) return { error: `Um duelo é de pelo menos ${R.duelMinStake} ☕.` };
  const balance = await balanceOf(user.id);
  if (balance < stake) return { error: `Só tens ${balance} ☕. Não se desafia com dinheiro que não se tem.` };

  const [row] = (await sql`
    WITH o AS (SELECT id, name FROM users WHERE id = ${opponentId}),
    d AS (
      INSERT INTO duels (challenger_id, opponent_id, stake, challenger_move)
      SELECT ${user.id}, o.id, ${stake}, ${move} FROM o
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${user.id}, ${-stake}, 'Duelo n.º ' || d.id || ': aposta contra ' || o.name FROM d, o
    )
    SELECT d.id, o.name FROM d, o
  `) as { id: number; name: string }[];
  if (!row) return { error: "Esse sócio não existe." };
  after(() =>
    pushToUsers([opponentId], {
      title: `⚔️ ${user.name} desafiou-te para um duelo`,
      body: `${stake} ☕ em jogo. Pedra, papel ou tesoura? Tens ${R.duelExpiryHours} horas.`,
      url: "/casino/duelos",
      tag: `duelo-${row.id}`,
    }),
  );
  revalidatePath("/casino/duelos");
  return { ok: `Desafio enviado a ${row.name}. A tua jogada fica selada até ele responder.` };
}

export async function respondDuel(duelId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const R = await getRules();
  const move = field(form, "move");
  if (!isMove(move)) return { error: "Escolhe pedra, papel ou tesoura." };
  const [duel] = (await sql`
    SELECT d.id, d.challenger_id, c.name AS challenger, d.stake, d.challenger_move
    FROM duels d JOIN users c ON c.id = d.challenger_id
    WHERE d.id = ${duelId} AND d.opponent_id = ${user.id} AND d.status = 'pending'
  `) as { id: number; challenger_id: number; challenger: string; stake: number; challenger_move: Move }[];
  if (!duel) return { error: "Este duelo já não está pendente." };
  const balance = await balanceOf(user.id);
  if (balance < duel.stake) return { error: `O duelo é de ${duel.stake} ☕ e só tens ${balance} ☕. Recusa com dignidade.` };

  const result = outcome(duel.challenger_move, move);
  const winnerId = result === "tie" ? null : result === "challenger" ? duel.challenger_id : user.id;
  const prize = duelPrize(duel.stake, R.duelHouseCutPct);
  const [row] = (await sql`
    WITH d AS (
      UPDATE duels SET opponent_move = ${move}, status = 'done', winner_id = ${winnerId}, resolved_at = now()
      WHERE id = ${duelId} AND status = 'pending'
      RETURNING id
    ),
    charge AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${user.id}, ${-duel.stake}, ${`Duelo n.º ${duelId}: aposta contra ${duel.challenger}`} FROM d
    ),
    payout AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT x.user_id, x.amount, x.reason FROM d, (VALUES
        (${winnerId}::int, ${prize}::int, ${`Duelo n.º ${duelId}: vitória`}),
        (${result === "tie" ? duel.challenger_id : null}::int, ${duel.stake}::int, ${`Duelo n.º ${duelId}: empate, devolução`}),
        (${result === "tie" ? user.id : null}::int, ${duel.stake}::int, ${`Duelo n.º ${duelId}: empate, devolução`})
      ) AS x(user_id, amount, reason)
      WHERE x.user_id IS NOT NULL
    )
    SELECT count(*)::int AS done FROM d
  `) as { done: number }[];
  if (!row?.done) return { error: "Este duelo já não está pendente." };

  const summary = `${moveEmoji(duel.challenger_move)} contra ${moveEmoji(move)}`;
  after(() =>
    pushToUsers([duel.challenger_id], {
      title:
        result === "tie"
          ? `⚔️ Empate com ${user.name}`
          : result === "challenger"
            ? `⚔️ Ganhaste o duelo a ${user.name}!`
            : `⚔️ ${user.name} ganhou-te o duelo`,
      body: `${summary} · ${result === "tie" ? "Cada um fica com o seu." : result === "challenger" ? `+${prize} ☕` : `−${duel.stake} ☕`}`,
      url: "/casino/duelos",
      tag: `duelo-${duelId}`,
    }),
  );
  revalidatePath("/casino/duelos");
  redirect(`/casino/duelos?duelo=${duelId}`);
}

async function refundPending(duelId: number, userColumn: "challenger" | "opponent", status: "declined" | "cancelled") {
  const user = await requireUser();
  const [row] = (await sql`
    WITH d AS (
      UPDATE duels SET status = ${status}, resolved_at = now()
      WHERE id = ${duelId} AND status = 'pending'
        AND (CASE WHEN ${userColumn}::text = 'challenger' THEN challenger_id ELSE opponent_id END) = ${user.id}
      RETURNING id, challenger_id, stake
    ),
    r AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT challenger_id, stake, ${`Duelo n.º ${duelId}: ${status === "declined" ? "recusado" : "cancelado"}, devolução`} FROM d
    )
    SELECT challenger_id FROM d
  `) as { challenger_id: number }[];
  return { user, row };
}

export async function declineDuel(duelId: number): Promise<void> {
  const { user, row } = await refundPending(duelId, "opponent", "declined");
  if (row) {
    after(() =>
      pushToUsers([row.challenger_id], {
        title: `🐔 ${user.name} recusou o teu duelo`,
        body: "Os grãos voltaram para ti. Fica o registo da cobardia.",
        url: "/casino/duelos",
        tag: `duelo-${duelId}`,
      }),
    );
  }
  revalidatePath("/casino/duelos");
}

export async function cancelDuel(duelId: number): Promise<void> {
  await refundPending(duelId, "challenger", "cancelled");
  revalidatePath("/casino/duelos");
}
