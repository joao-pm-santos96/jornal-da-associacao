"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { field, type FormState } from "@/lib/form";
import { getRules } from "@/lib/rules";
import { getNow } from "@/lib/seasons";
import { JOKE_MAX, comedyClock } from "@/lib/comedy";

async function clock() {
  return comedyClock(await getNow(), await getRules());
}

export async function submitJoke(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = field(form, "body");
  if (body.length < 3) return { error: "Escreve a piada (pelo menos 3 caracteres)." };
  if (body.length > JOKE_MAX) return { error: `A piada tem no máximo ${JOKE_MAX} caracteres. Se precisa de mais, não tem graça.` };
  const c = await clock();
  if (c.phase !== "submit") return { error: "A votação já abriu: as piadas desta semana estão fechadas." };
  const [row] = (await sql`
    INSERT INTO comedy_jokes (week_start, author_id, body) VALUES (${c.week}::date, ${user.id}, ${body})
    ON CONFLICT (week_start, author_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()
    RETURNING (xmax = 0) AS created
  `) as { created: boolean }[];
  revalidatePath("/comedy-club");
  return { ok: row.created ? "Piada entregue. Fica em segredo até sexta." : "Piada atualizada." };
}

export async function deleteJoke(): Promise<void> {
  const user = await requireUser();
  const c = await clock();
  if (c.phase !== "submit") return;
  await sql`DELETE FROM comedy_jokes WHERE week_start = ${c.week}::date AND author_id = ${user.id}`;
  revalidatePath("/comedy-club");
}

export async function voteJoke(jokeId: number): Promise<FormState> {
  const user = await requireUser();
  const c = await clock();
  if (c.phase !== "voting") return { error: "A votação não está aberta." };
  const [row] = (await sql`
    WITH j AS (
      SELECT id FROM comedy_jokes WHERE id = ${jokeId} AND week_start = ${c.week}::date AND author_id <> ${user.id}
    )
    INSERT INTO comedy_votes (week_start, voter_id, joke_id)
    SELECT ${c.week}::date, ${user.id}, j.id FROM j
    ON CONFLICT (week_start, voter_id) DO UPDATE SET joke_id = EXCLUDED.joke_id, voted_at = now()
    RETURNING joke_id
  `) as { joke_id: number }[];
  if (!row) return { error: "Não podes votar nessa piada (se é tua, nem penses)." };
  revalidatePath("/comedy-club");
  return { ok: "Voto registado. Podes mudar até a votação fechar." };
}
