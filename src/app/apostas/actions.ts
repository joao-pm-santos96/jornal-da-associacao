"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { holds } from "@/lib/offices";
import { GRAOS, getBalances } from "@/lib/economy";
import { field, type FormState } from "@/lib/form";
import { notifyBetResult, notifyNewBet } from "@/lib/push";

const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function refresh(betId?: number): void {
  revalidatePath("/", "layout");
  if (betId) revalidatePath(`/apostas/${betId}`);
}

export async function createBet(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await holds("apostas", user.id))) return { error: "Só o Gestor de Apostas pode abrir apostas." };
  const title = field(form, "title");
  const description = field(form, "description");
  const local = field(form, "closes_at");
  const labels = field(form, "options")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (title.length < 3 || title.length > 120) return { error: "A pergunta precisa de 3 a 120 caracteres." };
  if (description.length > 1000) return { error: "A descrição tem no máximo 1000 caracteres." };
  if (labels.length < 2 || labels.length > 6) return { error: "Uma aposta tem entre 2 e 6 opções, uma por linha." };
  if (labels.some((l) => l.length > 60)) return { error: "Cada opção tem no máximo 60 caracteres." };
  if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) return { error: "Há opções repetidas." };
  if (!LOCAL_DATETIME_RE.test(local)) return { error: "Escolhe a data e hora de fecho." };

  const [row] = (await sql`
    WITH b AS (
      INSERT INTO bets (created_by, title, description, closes_at, closing_notified_at)
      SELECT ${user.id}, ${title}, ${description}, t.closes_at,
        CASE WHEN t.closes_at <= now() + make_interval(hours => ${GRAOS.betClosingWarningHours}) THEN now() END
      FROM (SELECT ${local}::timestamp AT TIME ZONE 'Europe/Lisbon' AS closes_at) t
      WHERE t.closes_at > now() + interval '5 minutes'
      RETURNING id
    ),
    o AS (
      INSERT INTO bet_options (bet_id, position, label)
      SELECT b.id, t.position, t.label FROM b, unnest(${labels}::text[]) WITH ORDINALITY AS t(label, position)
    )
    SELECT id FROM b
  `) as { id: number }[];
  if (!row) return { error: "A aposta tem de fechar pelo menos daqui a 5 minutos." };
  after(() => notifyNewBet(row.id, user.id, title));
  refresh();
  redirect(`/apostas/${row.id}`);
}

export async function placeWager(betId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const optionId = Number(field(form, "option_id"));
  const amount = Number(field(form, "amount"));
  if (!Number.isInteger(optionId) || optionId <= 0) return { error: "Escolhe uma opção." };
  if (!Number.isInteger(amount) || amount < 1) return { error: "Aposta um número inteiro de grãos." };
  const balance = (await getBalances()).find((b) => b.user_id === user.id)?.balance ?? 0;
  if (balance <= 0) return { error: "Sem saldo positivo não há apostas. Vai escrever qualquer coisa." };
  if (amount > balance) return { error: `Só tens ${balance} ☕ para apostar.` };

  const [row] = (await sql`
    WITH o AS (
      SELECT o.id, o.label, o.bet_id FROM bet_options o JOIN bets b ON b.id = o.bet_id
      WHERE o.id = ${optionId} AND o.bet_id = ${betId} AND b.status = 'open' AND b.closes_at > now()
    ),
    w AS (
      INSERT INTO bet_wagers (bet_id, option_id, user_id, amount)
      SELECT bet_id, id, ${user.id}, ${amount} FROM o
      RETURNING id
    ),
    l AS (
      INSERT INTO ledger (user_id, amount, reason, created_by, bet_id)
      SELECT ${user.id}, ${-amount}, 'Aposta n.º ' || bet_id || ': «' || label || '»', ${user.id}, bet_id FROM o
    )
    SELECT label FROM o
  `) as { label: string }[];
  if (!row) return { error: "Esta aposta já fechou." };
  refresh(betId);
  return { ok: `Apostaste ${amount} ☕ em «${row.label}». Boa sorte!` };
}

export async function closeBetNow(betId: number): Promise<void> {
  const user = await requireUser();
  if (!(await holds("apostas", user.id))) return;
  await sql`UPDATE bets SET closes_at = now() WHERE id = ${betId} AND status = 'open' AND closes_at > now()`;
  refresh(betId);
}

export async function resolveBet(betId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await holds("apostas", user.id))) return { error: "Só o Gestor de Apostas declara resultados." };
  const optionId = Number(field(form, "option_id"));
  if (!Number.isInteger(optionId) || optionId <= 0) return { error: "Escolhe a opção vencedora." };

  const [row] = (await sql`
    WITH b AS (
      UPDATE bets SET status = 'resolved', winning_option = ${optionId}, resolved_at = now()
      WHERE id = ${betId} AND status = 'open' AND closes_at <= now()
        AND EXISTS (SELECT 1 FROM bet_options o WHERE o.id = ${optionId} AND o.bet_id = ${betId})
      RETURNING id
    ),
    w AS (SELECT user_id, option_id, amount FROM bet_wagers WHERE bet_id IN (SELECT id FROM b)),
    tot AS (
      SELECT coalesce(sum(amount), 0)::numeric AS pot,
        coalesce(sum(amount) FILTER (WHERE option_id = ${optionId}), 0)::numeric AS win,
        count(DISTINCT user_id) AS bettors
      FROM w
    ),
    pay AS (
      SELECT w.user_id,
        floor(sum(w.amount) * (tot.pot - ceil(tot.pot * ${GRAOS.betHouseCutPct}::numeric / 100)) / tot.win)::int AS prize
      FROM w, tot WHERE w.option_id = ${optionId}
      GROUP BY w.user_id, tot.pot, tot.win
    ),
    prizes AS (
      INSERT INTO ledger (user_id, amount, reason, created_by, bet_id)
      SELECT user_id, prize, ${`Aposta n.º ${betId}: prémio`}, ${user.id}, ${betId} FROM pay WHERE prize > 0
    ),
    fee AS (
      INSERT INTO ledger (user_id, amount, reason, created_by)
      SELECT ${user.id}, ${GRAOS.betManagerFee}, ${`Aposta n.º ${betId}: comissão de gestão`}, ${user.id}
      FROM tot WHERE tot.bettors >= ${GRAOS.betManagerMinBettors} AND EXISTS (SELECT 1 FROM b)
    )
    SELECT (SELECT count(*) FROM b)::int AS resolved, (SELECT label FROM bet_options WHERE id = ${optionId}) AS label
  `) as { resolved: number; label: string | null }[];
  if (!row?.resolved) return { error: "Só se declara o resultado de uma aposta fechada e ainda por resolver." };
  after(() => notifyBetResult(betId, `saiu «${row.label}»`));
  refresh(betId);
  return { ok: `Resultado declarado: «${row.label}». Os prémios já foram pagos.` };
}

export async function voidBet(betId: number): Promise<void> {
  const user = await requireUser();
  if (!(await holds("apostas", user.id))) return;
  const [row] = (await sql`
    WITH b AS (
      UPDATE bets SET status = 'void', resolved_at = now()
      WHERE id = ${betId} AND status = 'open'
      RETURNING id
    ),
    r AS (
      INSERT INTO ledger (user_id, amount, reason, created_by, bet_id)
      SELECT user_id, sum(amount), ${`Aposta n.º ${betId} anulada: devolução`}, ${user.id}, ${betId}
      FROM bet_wagers WHERE bet_id IN (SELECT id FROM b)
      GROUP BY user_id
    )
    SELECT count(*)::int AS voided FROM b
  `) as { voided: number }[];
  if (row?.voided) after(() => notifyBetResult(betId, "foi anulada"));
  refresh(betId);
}
