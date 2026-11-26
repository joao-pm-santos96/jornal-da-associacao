"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { field, type FormState } from "@/lib/form";
import { DURATIONS, YES_NO, closeDueAssemblies } from "@/lib/assembly";
import { holds } from "@/lib/offices";
import { notifyAssemblyComment, notifyAssemblyResults, notifyNewAssembly } from "@/lib/push";

function refresh(id?: number): void {
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/assembleia/${id}`);
}

export async function convene(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = field(form, "title");
  const body = field(form, "body");
  const kind = field(form, "kind");
  const hours = Number(field(form, "hours"));
  const secret = form.get("secret") === "on";
  const constitutional = form.get("constitutional") === "on";
  const binding = constitutional || form.get("binding") === "on";
  if (title.length < 5 || title.length > 140) return { error: "A pergunta precisa de 5 a 140 caracteres." };
  if (body.length > 2000) return { error: "O enquadramento tem no máximo 2000 caracteres." };
  if (kind !== "sim_nao" && kind !== "opcoes") return { error: "Escolhe o formato da votação." };
  if (!DURATIONS.some((d) => d.hours === hours)) return { error: "Escolhe a duração." };
  const labels =
    kind === "sim_nao"
      ? [...YES_NO]
      : field(form, "options").split("\n").map((l) => l.trim()).filter(Boolean);
  if (kind === "opcoes") {
    if (labels.length < 2 || labels.length > 6) return { error: "Uma votação tem entre 2 e 6 opções, uma por linha." };
    if (labels.some((l) => l.length > 80)) return { error: "Cada opção tem no máximo 80 caracteres." };
    if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) return { error: "Há opções repetidas." };
  }
  const [row] = (await sql`
    WITH a AS (
      INSERT INTO assemblies (created_by, title, body, kind, secret, binding, constitutional, closes_at)
      SELECT ${user.id}, ${title}, ${body}, ${kind}, ${secret}, ${binding}, ${constitutional}, now() + make_interval(hours => ${hours})
      WHERE NOT EXISTS (SELECT 1 FROM assemblies WHERE created_by = ${user.id} AND status = 'open')
      RETURNING id
    ),
    o AS (
      INSERT INTO assembly_options (assembly_id, position, label)
      SELECT a.id, t.position, t.label FROM a, unnest(${labels}::text[]) WITH ORDINALITY AS t(label, position)
    )
    SELECT id FROM a
  `) as { id: number }[];
  if (!row) return { error: "Já tens uma votação aberta. Espera que feche (ou anula-a) antes de convocar outra." };
  after(() => notifyNewAssembly(row.id, user.id, title));
  refresh();
  redirect(`/assembleia/${row.id}`);
}

export async function castVote(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const optionId = Number(field(form, "option_id"));
  if (!Number.isInteger(optionId) || optionId <= 0) return { error: "Escolhe uma opção." };
  const [row] = (await sql`
    WITH o AS (
      SELECT o.id, o.label FROM assembly_options o JOIN assemblies a ON a.id = o.assembly_id
      WHERE o.id = ${optionId} AND a.id = ${id} AND a.status = 'open' AND a.closes_at > now()
    ),
    v AS (
      INSERT INTO assembly_votes (assembly_id, user_id, option_id)
      SELECT ${id}, ${user.id}, o.id FROM o
      ON CONFLICT (assembly_id, user_id) DO UPDATE SET option_id = EXCLUDED.option_id, voted_at = now()
      RETURNING 1
    )
    SELECT label FROM o, v
  `) as { label: string }[];
  if (!row) return { error: "Esta votação já fechou." };
  const closed = await closeDueAssemblies();
  if (closed.length > 0) after(() => notifyAssemblyResults(closed));
  refresh(id);
  return { ok: closed.some((c) => c.id === id) ? `Votaste «${row.label}». Já votaram todos: a votação fechou.` : `Votaste «${row.label}». Podes mudar o voto até fechar.` };
}

export async function voidAssembly(id: number): Promise<void> {
  const user = await requireUser();
  await sql`
    UPDATE assemblies SET status = 'void', closed_at = now()
    WHERE id = ${id} AND status = 'open' AND (created_by = ${user.id} OR ${user.is_admin})
  `;
  refresh(id);
}

export async function markDone(id: number): Promise<void> {
  const user = await requireUser();
  const allowed = user.is_admin || (await holds("presidente", user.id)) || (await holds("tesoureiro", user.id));
  if (!allowed) return;
  await sql`
    UPDATE assemblies SET done_at = now(), done_by = ${user.id}
    WHERE id = ${id} AND status = 'closed' AND binding AND done_at IS NULL AND outcome IN ('aprovada', 'escolhida')
  `;
  refresh(id);
}

export async function addAssemblyComment(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = field(form, "body");
  if (body.length < 1 || body.length > 2000) return { error: "O comentário tem de ter entre 1 e 2000 caracteres." };
  const inserted = await sql`
    INSERT INTO assembly_comments (assembly_id, author_id, body)
    SELECT ${id}, ${user.id}, ${body} WHERE EXISTS (SELECT 1 FROM assemblies WHERE id = ${id})
    RETURNING id
  `;
  if (inserted.length === 0) return { error: "Esta votação não existe." };
  after(() => notifyAssemblyComment(id, user.id, body));
  refresh(id);
  return { ok: "Comentário publicado." };
}
