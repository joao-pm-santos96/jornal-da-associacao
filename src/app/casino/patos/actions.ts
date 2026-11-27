"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBalances } from "@/lib/economy";
import { field, type FormState } from "@/lib/form";
import { DUCKS, duckName } from "@/lib/ducks-table";
import { gameClosed } from "@/lib/modules";
import { holds } from "@/lib/offices";
import { notifyDecree } from "@/lib/push";
import { describeRace, getRaceSchedule, raceScheduleProblem, type RaceSchedule } from "@/lib/ducks";

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

export async function setRaceSchedule(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await holds("presidente", user.id))) return { error: "Só o Presidente marca a hora da Corrida de Patos." };
  const next: RaceSchedule = { day: Number(field(form, "day")), hour: Number(field(form, "hour")) };
  const problem = raceScheduleProblem(next);
  if (problem) return { error: problem };
  const current = await getRaceSchedule();
  if (current.day === next.day && current.hour === next.hour) return { error: "Esse já é o horário em vigor." };
  const title = `Corrida de Patos: passa a ser ${describeRace(next)}`;
  const body = `Por decreto presidencial, a Corrida de Patos passa a ser ${describeRace(next)}, já a partir da próxima corrida. Até agora era ${describeRace(current)}. As apostas já feitas mantêm-se.`;
  await sql.transaction([
    sql`
      INSERT INTO settings (key, value)
      SELECT k, v FROM unnest(ARRAY['patos_dia', 'patos_hora'], ${[String(next.day), String(next.hour)]}::text[]) AS t(k, v)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
    sql`
      WITH s AS (
        SELECT ((date_trunc('week', now() AT TIME ZONE 'Europe/Lisbon') + make_interval(days => ${next.day - 1}, hours => ${next.hour})) AT TIME ZONE 'Europe/Lisbon') AS slot
      ),
      t AS (SELECT CASE WHEN slot > now() THEN slot ELSE slot + interval '7 days' END AS race_at FROM s)
      UPDATE duck_races SET race_at = t.race_at FROM t
      WHERE duck_races.status = 'open' AND duck_races.race_at > now()
        AND NOT EXISTS (SELECT 1 FROM duck_races x WHERE x.race_at = t.race_at)
    `,
    sql`INSERT INTO decrees (author_id, title, body) VALUES (${user.id}, ${title}, ${body})`,
  ]);
  after(() => notifyDecree(user.id, title));
  revalidatePath("/", "layout");
  return { ok: "Horário decretado. A próxima corrida já segue o novo horário." };
}
