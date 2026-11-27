"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormState } from "@/lib/form";
import { cancelLoan, offerLoan, repayLoan, respondLoan } from "./actions";

const input = "border-2 border-ink bg-white p-1.5";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>;
  if (state.ok) return <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>;
  return null;
}

export function OfferLoanForm({ members, balance, maxDays, maxRate }: { members: { id: number; name: string }[]; balance: number; maxDays: number; maxRate: number }) {
  const [state, action, pending] = useActionState(offerLoan, {});
  const [principal, setPrincipal] = useState(Math.min(10, Math.max(balance, 1)));
  const [rate, setRate] = useState(10);
  const [days, setDays] = useState(7);
  const total = principal + Math.ceil((principal * rate) / 100);
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="loan-borrower" className="block text-xs font-semibold">A quem</label>
          <select id="loan-borrower" name="borrower_id" required className={`${input} w-full`}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="loan-principal" className="block text-xs font-semibold">Quantia (☕)</label>
          <input id="loan-principal" name="principal" type="number" min={1} max={Math.max(balance, 1)} step={1} required value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value) || 0)} className={`${input} w-full`} />
        </div>
        <div>
          <label htmlFor="loan-rate" className="block text-xs font-semibold">Juro (%)</label>
          <input id="loan-rate" name="rate" type="number" min={0} max={maxRate} step={1} required value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)} className={`${input} w-full`} />
        </div>
        <div>
          <label htmlFor="loan-days" className="block text-xs font-semibold">Prazo (dias)</label>
          <input id="loan-days" name="days" type="number" min={1} max={maxDays} step={1} required value={days}
            onChange={(e) => setDays(Number(e.target.value) || 0)} className={`${input} w-full`} />
        </div>
      </div>
      <p className="text-sm">
        Emprestas <strong>{principal} ☕</strong> e recebes <strong>{total} ☕</strong> daqui a {days} {days === 1 ? "dia" : "dias"}.
      </p>
      <button disabled={pending || balance <= 0} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
        🤝 Propor empréstimo
      </button>
    </form>
  );
}

function ActionButton({ label, confirmText, run, className }: { label: string; confirmText?: string; run: () => Promise<FormState>; className: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => setState(await run()));
        }}
        className={`${className} disabled:opacity-50`}
      >
        {label}
      </button>
      <Feedback state={state} />
    </span>
  );
}

export function RespondButtons({ loanId, principal, total }: { loanId: number; principal: number; total: number }) {
  return (
    <span className="flex flex-wrap gap-2">
      <ActionButton label="Aceitar" confirmText={`Aceitar ${principal} ☕ e ficar a dever ${total} ☕?`} run={() => respondLoan(loanId, true)}
        className="bg-ink px-3 py-1 text-xs font-bold uppercase text-white" />
      <ActionButton label="Recusar" run={() => respondLoan(loanId, false)} className="border-2 border-ink px-3 py-1 text-xs font-bold uppercase" />
    </span>
  );
}

export function CancelButton({ loanId }: { loanId: number }) {
  return <ActionButton label="Retirar proposta" run={() => cancelLoan(loanId)} className="text-xs font-semibold text-scoop underline" />;
}

export function RepayButton({ loanId, remaining, balance }: { loanId: number; remaining: number; balance: number }) {
  const pay = Math.min(remaining, Math.max(balance, 0));
  if (pay <= 0) return <span className="text-xs text-muted">Sem saldo para pagar agora.</span>;
  return (
    <ActionButton
      label={pay === remaining ? `Pagar tudo (${remaining} ☕)` : `Pagar ${pay} ☕ por conta`}
      confirmText={pay === remaining ? `Pagar ${remaining} ☕ e saldar o empréstimo?` : `Pagar ${pay} ☕ agora? Ficam a faltar ${remaining - pay} ☕.`}
      run={() => repayLoan(loanId)}
      className="bg-ink px-3 py-1 text-xs font-bold uppercase text-white"
    />
  );
}
