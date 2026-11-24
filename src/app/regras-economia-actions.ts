"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { field, type FormState } from "@/lib/form";
import { holds } from "@/lib/offices";
import { pushToAllExcept } from "@/lib/push";
import { RULE_DEFS, RULE_KEYS, defaultRules, formatRule, loadRules, type RuleKey } from "@/lib/rules";

type Change = { key: RuleKey; from: number; to: number };

function changeLine(c: Change): string {
  return `${RULE_DEFS[c.key].label}: de ${formatRule(c.key, c.from)} para ${formatRule(c.key, c.to)}`;
}

export async function updateRules(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await holds("tesoureiro", user.id))) return { error: "Só o Tesoureiro mexe nas regras da economia." };
  const current = await loadRules();
  const changes: Change[] = [];
  for (const key of RULE_KEYS) {
    const raw = field(form, key);
    if (raw === "") continue;
    const value = Number(raw);
    const def = RULE_DEFS[key];
    if (!Number.isInteger(value) || value < def.min || value > def.max) {
      return { error: `${def.label}: tem de ser um número inteiro entre ${formatRule(key, def.min)} e ${formatRule(key, def.max)}.` };
    }
    if (value !== current[key]) changes.push({ key, from: current[key], to: value });
  }
  if (changes.length === 0) return { error: "Não mudaste nenhum valor." };
  const reason = field(form, "reason");
  if (reason.length > 1000) return { error: "A justificação tem no máximo 1000 caracteres." };

  const title =
    changes.length === 1
      ? `${RULE_DEFS[changes[0].key].label}: ${formatRule(changes[0].key, changes[0].to)}`
      : `${changes.length} alterações às regras da economia`;
  const body = [changes.map((c) => `• ${changeLine(c)}`).join("\n"), reason].filter(Boolean).join("\n\n");

  await sql.transaction([
    sql`
      INSERT INTO economy_rules (key, value, updated_by)
      SELECT k, v, ${user.id} FROM unnest(${changes.map((c) => c.key)}::text[], ${changes.map((c) => c.to)}::int[]) AS t(k, v)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
    `,
    sql`INSERT INTO decrees (author_id, title, body, office) VALUES (${user.id}, ${title}, ${body}, 'tesoureiro')`,
  ]);
  after(() => pushToAllExcept(user.id, { title: "💰 Despacho do Tesoureiro", body: title, url: "/decretos" }));
  revalidatePath("/", "layout");
  return { ok: `Despacho publicado. ${changes.length === 1 ? "A alteração está" : `As ${changes.length} alterações estão`} em vigor a partir de agora.` };
}

export async function resetRules(): Promise<FormState> {
  const user = await requireUser();
  if (!user.is_admin) return { error: "Sem permissões." };
  const current = await loadRules();
  const defaults = defaultRules();
  const changes: Change[] = RULE_KEYS.filter((k) => current[k] !== defaults[k]).map((k) => ({ key: k, from: current[k], to: defaults[k] }));
  if (changes.length === 0) return { error: "Os valores já são os de origem." };
  const title = "Valores da economia repostos";
  const body = `A administração repôs os valores de origem.\n\n${changes.map((c) => `• ${changeLine(c)}`).join("\n")}`;
  await sql.transaction([
    sql`DELETE FROM economy_rules`,
    sql`INSERT INTO decrees (author_id, title, body, office) VALUES (${user.id}, ${title}, ${body}, 'admin')`,
  ]);
  after(() => pushToAllExcept(user.id, { title: "🛠️ Intervenção da Administração", body: title, url: "/decretos" }));
  revalidatePath("/", "layout");
  return { ok: `Repostos ${changes.length} ${changes.length === 1 ? "valor" : "valores"}. Saiu um despacho em /decretos.` };
}
