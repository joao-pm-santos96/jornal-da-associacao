"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getEconomy } from "@/lib/economy";
import { field, type FormState } from "@/lib/form";
import { pushToUsers } from "@/lib/push";
import { LOAN_MAX_DAYS, LOAN_MAX_RATE, balanceOf, collect, getLoan, loanTotal } from "@/lib/loans";

const PAGE = "/cofre/emprestimos";

function refresh(): void {
  revalidatePath(PAGE);
  revalidatePath("/", "layout");
}

export async function offerLoan(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const borrowerId = Number(field(form, "borrower_id"));
  const principal = Number(field(form, "principal"));
  const rate = Number(field(form, "rate"));
  const days = Number(field(form, "days"));
  if (!Number.isInteger(borrowerId) || borrowerId <= 0 || borrowerId === user.id) return { error: "Escolhe a quem emprestas." };
  if (!Number.isInteger(principal) || principal <= 0) return { error: "A quantia tem de ser um número inteiro de grãos." };
  if (!Number.isInteger(rate) || rate < 0 || rate > LOAN_MAX_RATE) return { error: `O juro vai de 0% a ${LOAN_MAX_RATE}%.` };
  if (!Number.isInteger(days) || days < 1 || days > LOAN_MAX_DAYS) return { error: `O prazo vai de 1 a ${LOAN_MAX_DAYS} dias.` };
  const economy = await getEconomy();
  if (!economy.open) return { error: "O Cofre está fechado para obras." };
  const balance = economy.balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  if (balance < principal) return { error: `Tens ${balance} ☕, não chega para emprestar ${principal} ☕.` };
  const total = loanTotal(principal, rate);
  const [row] = (await sql`
    WITH u AS (
      SELECT id, name FROM users WHERE id = ${borrowerId}
        AND NOT EXISTS (
          SELECT 1 FROM loans WHERE lender_id = ${user.id} AND borrower_id = ${borrowerId} AND status IN ('offered', 'active', 'defaulted')
        )
    ),
    l AS (
      INSERT INTO loans (lender_id, borrower_id, principal, rate_pct, term_days, total)
      SELECT ${user.id}, u.id, ${principal}, ${rate}, ${days}, ${total} FROM u
      RETURNING id
    )
    SELECT l.id, u.name FROM l, u
  `) as { id: number; name: string }[];
  if (!row) return { error: "Já há um empréstimo teu a esse sócio por resolver." };
  after(() =>
    pushToUsers([borrowerId], {
      title: `🤝 ${user.name} oferece-te um empréstimo de ${principal} ☕`,
      body: `Devolves ${total} ☕ (${rate}% de juro) em ${days} ${days === 1 ? "dia" : "dias"}. Aceita ou recusa no Cofre.`,
      url: PAGE,
      tag: `emprestimo-${row.id}`,
    }),
  );
  refresh();
  return { ok: `Proposta enviada a ${row.name}. Tem 48 horas para aceitar.` };
}

export async function respondLoan(loanId: number, accept: boolean): Promise<FormState> {
  const user = await requireUser();
  const loan = await getLoan(loanId);
  if (!loan || loan.status !== "offered" || loan.borrower_id !== user.id) return { error: "Esta proposta já não está disponível." };
  if (!accept) {
    await sql`UPDATE loans SET status = 'declined', settled_at = now() WHERE id = ${loanId} AND status = 'offered'`;
    after(() =>
      pushToUsers([loan.lender_id], { title: `🤝 ${user.name} recusou o teu empréstimo`, body: "Os grãos ficam contigo.", url: PAGE, tag: `emprestimo-${loanId}` }),
    );
    refresh();
    return { ok: "Proposta recusada." };
  }
  if ((await balanceOf(loan.lender_id)) < loan.principal) {
    return { error: `${loan.lender} já não tem os ${loan.principal} ☕ para te emprestar.` };
  }
  const [row] = (await sql`
    WITH u AS (
      UPDATE loans SET status = 'active', accepted_at = now(), due_at = now() + make_interval(days => term_days)
      WHERE id = ${loanId} AND status = 'offered' AND borrower_id = ${user.id}
      RETURNING id, due_at
    ),
    g AS (
      INSERT INTO ledger (user_id, amount, reason, kind)
      SELECT ${loan.lender_id}::int, ${-loan.principal}::int, 'Empréstimo n.º ' || ${loanId} || ': emprestado a ' || member_label(${user.id}), 'emprestimo' FROM u
      UNION ALL
      SELECT ${user.id}::int, ${loan.principal}::int, 'Empréstimo n.º ' || ${loanId} || ': recebido de ' || member_label(${loan.lender_id}), 'emprestimo' FROM u
    )
    SELECT id, due_at FROM u
  `) as { id: number; due_at: Date }[];
  if (!row) return { error: "Esta proposta já não está disponível." };
  after(() =>
    pushToUsers([loan.lender_id], {
      title: `🤝 ${user.name} aceitou o teu empréstimo`,
      body: `Emprestaste ${loan.principal} ☕. Recebes ${loan.total} ☕ no fim do prazo.`,
      url: PAGE,
      tag: `emprestimo-${loanId}`,
    }),
  );
  refresh();
  return { ok: `Recebeste ${loan.principal} ☕. Tens de devolver ${loan.total} ☕.` };
}

export async function cancelLoan(loanId: number): Promise<FormState> {
  const user = await requireUser();
  const [row] = (await sql`
    UPDATE loans SET status = 'cancelled', settled_at = now()
    WHERE id = ${loanId} AND status = 'offered' AND lender_id = ${user.id}
    RETURNING id
  `) as { id: number }[];
  refresh();
  return row ? { ok: "Proposta retirada." } : { error: "Esta proposta já não pode ser retirada." };
}

export async function repayLoan(loanId: number): Promise<FormState> {
  const user = await requireUser();
  const loan = await getLoan(loanId);
  if (!loan || loan.borrower_id !== user.id || (loan.status !== "active" && loan.status !== "defaulted")) {
    return { error: "Este empréstimo já não está por pagar." };
  }
  const balance = await balanceOf(user.id);
  if (balance <= 0) return { error: `Tens ${balance} ☕. Não há nada para pagar por agora.` };
  const updated = await collect(loan, balance, "devolução");
  if (!updated) return { error: "O empréstimo mudou entretanto. Recarrega a página." };
  const paid = updated.repaid - loan.repaid;
  const done = updated.status === "repaid";
  after(() =>
    pushToUsers([loan.lender_id], {
      title: done ? `🤝 ${user.name} pagou o empréstimo` : `🤝 ${user.name} pagou ${paid} ☕ do empréstimo`,
      body: done ? `Recebeste tudo: ${loan.total} ☕.` : `Faltam ${updated.total - updated.repaid} ☕.`,
      url: PAGE,
      tag: `emprestimo-${loanId}`,
    }),
  );
  refresh();
  return { ok: done ? `Pagaste tudo. Empréstimo saldado.` : `Pagaste ${paid} ☕. Faltam ${updated.total - updated.repaid} ☕.` };
}
