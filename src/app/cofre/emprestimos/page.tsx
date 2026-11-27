import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getEconomy } from "@/lib/economy";
import { formatDateTime } from "@/lib/dates";
import { LOAN_MAX_DAYS, LOAN_MAX_RATE, LOAN_OFFER_HOURS, listLoans, type Loan } from "@/lib/loans";
import { CancelButton, OfferLoanForm, RepayButton, RespondButtons } from "./LoanForms";

function terms(l: Loan): string {
  return `${l.principal} ☕ a ${l.rate_pct}% · devolve ${l.total} ☕ em ${l.term_days} ${l.term_days === 1 ? "dia" : "dias"}`;
}

function owedLine(l: Loan): string {
  const left = l.total - l.repaid;
  if (l.status === "defaulted") return `🚨 Em incumprimento · faltam ${left} ☕${l.repaid > 0 ? ` (já pagou ${l.repaid})` : ""}`;
  return `Faltam ${left} ☕ · prazo ${l.due_at ? formatDateTime(l.due_at) : "—"}`;
}

export default async function LoansPage() {
  const user = await requireUser();
  const [economy, loans] = await Promise.all([getEconomy(), listLoans()]);
  const balance = economy.balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const members = economy.balances
    .filter((b) => b.user_id !== user.id)
    .map((b) => ({ id: b.user_id, name: b.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const offersToMe = loans.filter((l) => l.status === "offered" && l.borrower_id === user.id);
  const myOffers = loans.filter((l) => l.status === "offered" && l.lender_id === user.id);
  const iOwe = loans.filter((l) => (l.status === "active" || l.status === "defaulted") && l.borrower_id === user.id);
  const owedToMe = loans.filter((l) => (l.status === "active" || l.status === "defaulted") && l.lender_id === user.id);
  const board = loans.filter((l) => l.status === "active" || l.status === "defaulted");
  const repaid = loans.filter((l) => l.status === "repaid");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <p className="text-sm">
        <Link href="/cofre" className="underline hover:text-scoop">← Cofre</Link>
      </p>
      <header className="border-b-4 border-ink pb-3">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Banca entre amigos</p>
        <h1 className="font-display text-4xl font-black">🤝 Empréstimos</h1>
        <p className="text-sm text-muted">
          Empresta grãos a outro sócio com o juro e o prazo que quiseres. No fim do prazo, o Cofre cobra sozinho. Se não houver saldo, cobra o que houver e o
          resto vai sendo cobrado sempre que entrarem grãos na conta de quem deve.
        </p>
      </header>

      {economy.open && (
        <section className="border-2 border-ink bg-white p-4">
          <h2 className="mb-3 font-display text-2xl font-black">Emprestar</h2>
          <p className="mb-2 text-sm text-muted">Tens {balance} ☕. A proposta fica {LOAN_OFFER_HOURS} horas à espera de resposta e os grãos só saem quando for aceite.</p>
          <OfferLoanForm members={members} balance={balance} maxDays={LOAN_MAX_DAYS} maxRate={LOAN_MAX_RATE} />
        </section>
      )}

      {offersToMe.length > 0 && (
        <section className="space-y-2">
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Propostas para ti</h2>
          <ul className="divide-y divide-rule">
            {offersToMe.map((l) => (
              <li key={l.id} className="space-y-2 py-3">
                <p><strong>{l.lender}</strong> empresta-te {terms(l)}.</p>
                <RespondButtons loanId={l.id} principal={l.principal} total={l.total} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {iOwe.length > 0 && (
        <section className="space-y-2">
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">O que deves</h2>
          <ul className="divide-y divide-rule">
            {iOwe.map((l) => (
              <li key={l.id} className="space-y-2 py-3">
                <p>A <strong>{l.lender}</strong>: {terms(l)}.</p>
                <p className={`text-sm ${l.status === "defaulted" ? "font-bold text-scoop" : ""}`}>{owedLine(l)}</p>
                <RepayButton loanId={l.id} remaining={l.total - l.repaid} balance={balance} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(owedToMe.length > 0 || myOffers.length > 0) && (
        <section className="space-y-2">
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">O que te devem</h2>
          <ul className="divide-y divide-rule">
            {myOffers.map((l) => (
              <li key={l.id} className="space-y-1 py-3">
                <p><strong>{l.borrower}</strong>: {terms(l)}.</p>
                <p className="text-sm text-muted">À espera de resposta.</p>
                <CancelButton loanId={l.id} />
              </li>
            ))}
            {owedToMe.map((l) => (
              <li key={l.id} className="space-y-1 py-3">
                <p><strong>{l.borrower}</strong>: {terms(l)}.</p>
                <p className={`text-sm ${l.status === "defaulted" ? "font-bold text-scoop" : ""}`}>{owedLine(l)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Quem deve a quem</h2>
        {board.length === 0 ? (
          <p className="text-muted">Ninguém deve nada a ninguém. Por enquanto.</p>
        ) : (
          <ul className="divide-y divide-rule text-sm">
            {board.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span><strong>{l.borrower}</strong> deve a <strong>{l.lender}</strong></span>
                <span className={l.status === "defaulted" ? "font-bold text-scoop" : ""}>{owedLine(l)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {repaid.length > 0 && (
        <section>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Pagos</h2>
          <ul className="divide-y divide-rule text-sm">
            {repaid.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>{l.borrower} pagou a {l.lender}</span>
                <span>{l.total} ☕ · {l.settled_at ? formatDateTime(l.settled_at) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
