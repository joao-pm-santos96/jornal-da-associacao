"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { field, type FormState } from "@/lib/form";
import { DUCKS, duckName } from "@/lib/ducks-table";
import { gameClosed } from "@/lib/modules";

export async function placeDuckBet(raceId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const closed = await gameClosed("patos");
  if (closed) return { error: closed };
  const duck = Number(field(form, "duck"));
  const amount = Number(field(form, "amount"));
  if (!DUCKS.some((d) => d.n === duck)) return { error: "Escolhe um pato." };
  if (!Number.isInteger(amount) || amount < 1) return { error: "Aposta um número inteiro de grãos." };
  const balance = (await getBalances()).find((b) => b.user_id === user.id)?.balance ?? 0;
  if (balance <= 0) return { error: "Sem saldo positivo não há apostas. Os patos não aceitam fiado." };
  if (amount > balance) return { error: `Só tens ${balance} ☕ para apostar.` };

  const [row] = (await sql`
    WITH r AS (SELECT id FROM duck_races WHERE id = ${raceId} AND status = 'open' AND race_at > now()),
    b AS (
      INSERT INTO duck_bets (race_id, user_id, duck, amount)
      SELECT id, ${user.id}, ${duck}, ${amount} FROM r
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason)
      SELECT ${user.id}, ${-amount}, ${`Corrida de Patos n.º ${raceId}: aposta no ${duckName(duck)}`} FROM r
    )
    SELECT count(*)::int AS placed FROM b
  `) as { placed: number }[];
  if (!row?.placed) return { error: "As apostas para esta corrida já fecharam." };
  revalidatePath("/casino/patos");
  return { ok: `Apostaste ${amount} ☕ no ${duckName(duck)}. Quá quá!` };
}
