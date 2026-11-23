"use client";

import { startTransition, useActionState } from "react";
import { createBet, placeWager, resolveBet } from "./actions";
import type { FormState } from "@/lib/form";

const input = "border-2 border-ink bg-white p-1.5";
const button = "bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>;
  if (state.ok) return <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>;
  return null;
}

export function NewBetForm() {
  const [state, action, pending] = useActionState(createBet, {});
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <Feedback state={state} />
      <div>
        <label htmlFor="bet-title" className="block text-xs font-semibold">Pergunta</label>
        <input id="bet-title" name="title" required minLength={3} maxLength={120}
          placeholder="ex.: O Tiago chega a horas ao jantar?" className={`${input} w-full`} />
      </div>
      <div>
        <label htmlFor="bet-description" className="block text-xs font-semibold">Regras e letra miudinha (opcional)</label>
        <textarea id="bet-description" name="description" maxLength={1000} rows={2} className={`${input} w-full`} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="bet-options" className="block text-xs font-semibold">Opções (uma por linha, 2 a 6)</label>
          <textarea id="bet-options" name="options" required rows={4} defaultValue={"Sim\nNão"} className={`${input} w-56`} />
        </div>
        <div>
          <label htmlFor="bet-closes" className="block text-xs font-semibold">Fecha em (Ílhavo)</label>
          <input id="bet-closes" name="closes_at" type="datetime-local" required className={input} />
        </div>
      </div>
      <button disabled={pending} className={button}>🎲 Abrir aposta</button>
    </form>
  );
}

export function WagerForm({
  betId,
  options,
  balance,
}: {
  betId: number;
  options: { id: number; label: string }[];
  balance: number;
}) {
  const [state, action, pending] = useActionState(placeWager.bind(null, betId), {});
  if (balance <= 0) {
    return <p className="text-sm text-muted">Sem saldo positivo não há apostas. Tens {balance} ☕.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="wager-option" className="block text-xs font-semibold">Aposto em</label>
          <select id="wager-option" name="option_id" required className={input}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="wager-amount" className="block text-xs font-semibold">Grãos (tens {balance} ☕)</label>
          <input id="wager-amount" name="amount" type="number" min={1} max={balance} step={1} required defaultValue={Math.min(5, balance)}
            className={`${input} w-28`} />
        </div>
        <button disabled={pending} className={button}>Apostar</button>
      </div>
    </form>
  );
}

export function ResolveForm({ betId, options }: { betId: number; options: { id: number; label: string }[] }) {
  const [state, action, pending] = useActionState(resolveBet.bind(null, betId), {});
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!confirm("Declarar este resultado? Os prémios são pagos logo e não há volta atrás.")) e.preventDefault();
      }}
    >
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="resolve-option" className="block text-xs font-semibold">Opção vencedora</label>
          <select id="resolve-option" name="option_id" required className={input}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <button disabled={pending} className={button}>Declarar resultado</button>
      </div>
    </form>
  );
}
