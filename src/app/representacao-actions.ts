"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { GRAOS, getEconomy, weekOf } from "@/lib/economy";
import { field, type FormState } from "@/lib/form";
import { LETTER_PUSH, OFFICES, getOffices, holds, type Office } from "@/lib/offices";
import { pushToAllExcept, pushToUsers } from "@/lib/push";
import { getNow } from "@/lib/seasons";
import { grains } from "@/lib/grains";
import { EXCUSES, REPRESENTATION, bust, representationTotal, rollCaught, slushHolders, slushState, type Busted } from "@/lib/slush";

async function inOffice(userId: number): Promise<boolean> {
  return (await holds("tesoureiro", userId)) || (await holds("presidente", userId));
}

export async function spendRepresentation(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await inOffice(user.id))) return { error: "Só o governo tem despesas de representação." };
  const economy = await getEconomy();
  if (!economy.open) return { error: "O Cofre está fechado para obras." };
  const amount = Number(field(form, "amount"));
  const excuse = field(form, "excuse");
  const max = Math.floor((Math.max(economy.available, 0) * GRAOS.slushPct) / 100);
  if (!(EXCUSES as readonly string[]).includes(excuse)) return { error: "Escolhe a justificação." };
  if (max < 1) return { error: "O Cofre está tão magro que nem dá para um almoço." };
  if (!Number.isInteger(amount) || amount < 1 || amount > max) return { error: `O valor tem de ser entre 1 e ${max} ☕.` };
  const week = weekOf(await getNow());
  const [row] = (await sql`
    INSERT INTO slush_moves (owner_id, amount, kind, reason, week_start)
    SELECT ${user.id}, ${amount}, 'desvio', ${`${REPRESENTATION}: ${excuse}`}, ${week}::date
    WHERE NOT EXISTS (
      SELECT 1 FROM slush_moves WHERE owner_id = ${user.id} AND kind = 'desvio' AND week_start = ${week}::date
    )
    RETURNING id
  `) as { id: number }[];
  if (!row) return { error: "Já justificaste uma despesa esta semana. Não abuses." };
  revalidatePath("/", "layout");
  return { ok: `${amount} ☕ justificados. Ninguém precisa de saber para onde foram.` };
}

export async function launder(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const amount = Number(field(form, "amount"));
  if (!Number.isInteger(amount) || amount < 1 || amount > GRAOS.slushWashCap) {
    return { error: `Entre 1 e ${GRAOS.slushWashCap} ☕ de cada vez.` };
  }
  const week = weekOf(await getNow());
  const [row] = (await sql`
    WITH s AS (
      SELECT coalesce(sum(amount), 0) AS balance,
        coalesce(sum(-amount) FILTER (WHERE kind = 'lavagem' AND week_start = ${week}::date), 0) AS washed
      FROM slush_moves WHERE owner_id = ${user.id}
    ),
    m AS (
      INSERT INTO slush_moves (owner_id, amount, kind, reason, week_start)
      SELECT ${user.id}, ${-amount}, 'lavagem', 'Consultoria', ${week}::date
      FROM s WHERE s.balance >= ${amount} AND s.washed + ${amount} <= ${GRAOS.slushWashCap}
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${amount}, 'Consultoria', 'consultoria' FROM m
    )
    SELECT count(*)::int AS n FROM m
  `) as { n: number }[];
  if (row.n === 0) {
    return { error: `Não tens tanto no saco, ou já passaste ${GRAOS.slushWashCap} ☕ esta semana.` };
  }
  revalidatePath("/", "layout");
  return { ok: `${amount} ☕ de consultoria na tua carteira. Limpinhos.` };
}

function announce(busted: Busted[], denounced: boolean) {
  return Promise.all(
    busted.flatMap((b) => [
      pushToUsers([b.culprit_id], {
        title: denounced ? "🚨 Foste denunciado" : "🚨 A auditoria apanhou-te",
        body: `O teu saco azul (${b.recovered} ☕) voltou ao Cofre${b.fine > 0 ? ` e pagas ${b.fine} ☕ de multa` : ""}.`,
        url: "/",
      }),
      pushToAllExcept(b.culprit_id, {
        title: "🚨 Escândalo no Cofre",
        body: `Apanhado um saco azul com ${b.recovered} ☕. Vê quem foi na primeira página.`,
        url: "/",
      }),
    ]),
  );
}

export async function requestAudit(): Promise<FormState> {
  const user = await requireUser();
  const economy = await getEconomy();
  if (!economy.open) return { error: "O Cofre está fechado para obras." };
  const balance = economy.balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  if (balance < GRAOS.auditCost) return { error: `Uma auditoria custa ${GRAOS.auditCost} ☕ e tens ${grains(balance)} ☕.` };
  if ((await representationTotal()) <= 0) return { error: "Não há despesas de representação para auditar." };
  const now = await getNow();
  const week = weekOf(now);
  const [audit] = (await sql.transaction([
    sql`
      INSERT INTO audits (auditor_id, kind, week_start, found)
      VALUES (${user.id}, 'auditoria', ${week}::date, false)
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    sql`
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${user.id}, ${-GRAOS.auditCost}, 'Auditoria às contas do governo', 'auditoria'
      WHERE EXISTS (SELECT 1 FROM audits WHERE auditor_id = ${user.id} AND kind = 'auditoria' AND week_start = ${week}::date
        AND created_at = now())
    `,
  ])) as { id: number }[][];
  if (audit.length === 0) return { error: "Já pediste uma auditoria esta semana. Volta para a semana." };

  const suspects = (await slushHolders(now)).filter((h) => h.owner_id !== user.id && !h.immune);
  const busted: Busted[] = [];
  for (const s of suspects) {
    if (!rollCaught(s.balance)) continue;
    const reward = Math.round((s.balance * GRAOS.auditRewardPct) / 100);
    const b = await bust(s, "auditoria", now, { user_id: user.id, amount: reward, hidden: false });
    if (b) busted.push(b);
  }
  revalidatePath("/", "layout");
  if (busted.length === 0) {
    const escaped = suspects.map((s) => s.owner_id);
    after(() =>
      pushToUsers(escaped, {
        title: "🕵️ Alguém anda a fazer perguntas",
        body: "Houve uma auditoria às contas do governo. Desta vez escapaste.",
        url: "/cofre/saco-azul",
      }),
    );
    return { ok: `A auditoria não encontrou nada. Os ${GRAOS.auditCost} ☕ ficam no Cofre.` };
  }
  await sql`UPDATE audits SET found = true WHERE id = ${audit[0].id}`;
  after(() => announce(busted, false));
  const recovered = busted.reduce((sum, b) => sum + b.recovered, 0);
  const reward = busted.reduce((sum, b) => sum + Math.round((b.recovered * GRAOS.auditRewardPct) / 100), 0);
  return { ok: `Apanhado! ${recovered} ☕ voltam ao Cofre e recebes ${reward} ☕ de recompensa.` };
}

export async function denounce(): Promise<FormState> {
  const user = await requireUser();
  const now = await getNow();
  const week = weekOf(now);
  const mine = await slushState(user.id, now);
  if (mine.balance <= 0) return { error: "Só quem tem as mãos sujas sabe a quem denunciar." };
  const [row] = (await sql`
    INSERT INTO audits (auditor_id, kind, week_start, found)
    VALUES (${user.id}, 'denuncia', ${week}::date, false)
    ON CONFLICT DO NOTHING
    RETURNING id
  `) as { id: number }[];
  if (!row) return { error: "Já fizeste uma denúncia esta semana." };
  const others = (await slushHolders(now)).filter((h) => h.owner_id !== user.id && !h.immune);
  const busted: Busted[] = [];
  for (const o of others) {
    const b = await bust(o, "denuncia", now, { user_id: user.id, amount: Math.floor(o.balance / 2), hidden: true });
    if (b) busted.push(b);
  }
  revalidatePath("/", "layout");
  if (busted.length === 0) return { ok: "A Judiciária foi ver e não encontrou nada. Por agora." };
  await sql`UPDATE audits SET found = true WHERE id = ${row.id}`;
  after(() => announce(busted, true));
  const share = busted.reduce((sum, b) => sum + Math.floor(b.recovered / 2), 0);
  return { ok: `Denúncia certeira. ${share} ☕ de honorários no teu saco, e esta semana as auditorias não te tocam.` };
}

export async function markLetterRead(office: Office): Promise<void> {
  const user = await requireUser();
  if (!OFFICES.includes(office) || !(await holds(office, user.id))) return;
  await sql`INSERT INTO office_letters (user_id, office) VALUES (${user.id}, ${office}) ON CONFLICT DO NOTHING`;
}

export async function sendOfficeLetter(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.is_admin) return { error: "Sem permissões." };
  const office = field(form, "office") as Office;
  if (!OFFICES.includes(office)) return { error: "Cargo inválido." };
  const holder = (await getOffices())[office];
  if (!holder) return { error: "O cargo está vago." };
  await pushToUsers([holder.user_id], LETTER_PUSH);
  return { ok: `Aviso enviado a ${holder.name}.` };
}
