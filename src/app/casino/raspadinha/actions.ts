"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { drawTicket } from "@/lib/scratch";
import { getRules, scratchPrizes } from "@/lib/rules";
import { gameClosed } from "@/lib/modules";

export type Ticket = { id: number; cells: string[]; prize: number; cost: number };

export async function buyTicket(): Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }> {
  const user = await requireUser();
  const closed = await gameClosed("raspadinha");
  if (closed) return { ok: false, error: closed };
  const [pending] = (await sql`
    SELECT id FROM scratch_tickets WHERE user_id = ${user.id} AND scratched_at IS NULL LIMIT 1
  `) as { id: number }[];
  if (pending) return { ok: false, error: "Ainda tens um bilhete por raspar." };
  const R = await getRules();
  const cost = R.scratchCost;
  const balance = (await getBalances()).find((b) => b.user_id === user.id)?.balance ?? 0;
  if (balance < cost) {
    return { ok: false, error: `O bilhete custa ${cost} ☕ e tens ${balance} ☕.` };
  }
  const { cells, prize } = drawTicket(cost, scratchPrizes(R));
  const [row] = (await sql`
    WITH t AS (
      INSERT INTO scratch_tickets (user_id, cost, cells, prize)
      VALUES (${user.id}, ${cost}, ${cells.join(",")}, ${prize})
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${-cost}, 'Raspadinha: bilhete n.º ' || id, 'raspadinha' FROM t
    )
    SELECT id FROM t
  `) as { id: number }[];
  return { ok: true, ticket: { id: row.id, cells, prize, cost } };
}

export async function markScratched(ticketId: number): Promise<void> {
  const user = await requireUser();
  await sql`
    WITH t AS (
      UPDATE scratch_tickets SET scratched_at = now()
      WHERE id = ${ticketId} AND user_id = ${user.id} AND scratched_at IS NULL
      RETURNING id, prize, created_at
    )
    INSERT INTO ledger (user_id, amount, reason, kind)
    SELECT ${user.id}, prize, 'Raspadinha: prémio do bilhete n.º ' || id, 'raspadinha' FROM t
    WHERE prize > 0
      AND created_at >= (SELECT value::timestamptz FROM settings WHERE key = 'economia_inicio')
  `;
}
