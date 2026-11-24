"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { drawTicket } from "@/lib/scratch";
import { SCRATCH_COST } from "@/lib/scratch-table";

export type Ticket = { id: number; cells: string[]; prize: number };

export async function buyTicket(): Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }> {
  const user = await requireUser();
  const [pending] = (await sql`
    SELECT id FROM scratch_tickets WHERE user_id = ${user.id} AND scratched_at IS NULL LIMIT 1
  `) as { id: number }[];
  if (pending) return { ok: false, error: "Ainda tens um bilhete por raspar." };
  const balance = (await getBalances()).find((b) => b.user_id === user.id)?.balance ?? 0;
  if (balance < SCRATCH_COST) {
    return { ok: false, error: `O bilhete custa ${SCRATCH_COST} ☕ e tens ${balance} ☕.` };
  }
  const { cells, prize } = drawTicket();
  const [row] = (await sql`
    WITH t AS (
      INSERT INTO scratch_tickets (user_id, cost, cells, prize)
      VALUES (${user.id}, ${SCRATCH_COST}, ${cells.join(",")}, ${prize})
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${-SCRATCH_COST}, 'Raspadinha: bilhete n.º ' || id, 'raspadinha' FROM t
    )
    SELECT id FROM t
  `) as { id: number }[];
  return { ok: true, ticket: { id: row.id, cells, prize } };
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
