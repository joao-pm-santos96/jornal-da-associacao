"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { SLOT_BETS, multiplier, spinReels, type SlotBet } from "@/lib/slots";

export type SpinResult =
  | { ok: true; reels: [string, string, string]; payout: number; bet: number; balance: number }
  | { ok: false; error: string };

export async function spinSlot(bet: number): Promise<SpinResult> {
  const user = await requireUser();
  if (!SLOT_BETS.includes(bet as SlotBet)) return { ok: false, error: "Aposta inválida." };
  const balance = (await getBalances()).find((b) => b.user_id === user.id)?.balance ?? 0;
  if (balance < bet) {
    return { ok: false, error: `Tens ${balance} ☕ e a jogada custa ${bet} ☕. O crupiê não aceita fiado.` };
  }
  const reels = spinReels();
  const payout = bet * multiplier(reels);
  await sql.transaction([
    sql`INSERT INTO slot_spins (user_id, bet, reels, payout) VALUES (${user.id}, ${bet}, ${reels.join("")}, ${payout})`,
    sql`
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, a, r, 'slot' FROM (VALUES (${-bet}::int, 'Slot machine: jogada'), (${payout}::int, 'Slot machine: prémio')) AS t(a, r)
      WHERE a <> 0
    `,
  ]);
  return { ok: true, reels, payout, bet, balance: balance - bet + payout };
}
