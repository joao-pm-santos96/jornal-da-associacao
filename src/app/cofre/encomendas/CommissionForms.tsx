"use client";

import { useActionState } from "react";
import { claimCommission, createCommission } from "@/app/economia-actions";

const input = "border-2 border-ink bg-white p-1.5";

export function NewCommissionForm({ balance, maxDays }: { balance: number; maxDays: number }) {
  const [state, action, pending] = useActionState(createCommission, {});
  if (balance < 1) return <p className="text-sm">Precisas de saldo positivo para encomendar. Tens {balance} ☕.</p>;
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <div>
        <label htmlFor="c-theme" className="block text-xs font-semibold">Tema do post</label>
        <input id="c-theme" name="theme" required minLength={3} maxLength={140}
          placeholder="ex.: crítica gastronómica à última sardinhada" className={`${input} w-full`} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="c-reward" className="block text-xs font-semibold">Recompensa (tens {balance} ☕)</label>
          <input id="c-reward" name="reward" type="number" min={1} max={balance} step={1} required defaultValue={Math.min(5, balance)}
            className={`${input} w-28`} />
        </div>
        <div>
          <label htmlFor="c-days" className="block text-xs font-semibold">Prazo (dias)</label>
          <input id="c-days" name="days" type="number" min={1} max={maxDays} step={1} required defaultValue={7} className={`${input} w-24`} />
        </div>
        <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          Encomendar
        </button>
      </div>
    </form>
  );
}

export function ClaimForm({ commissionId, posts }: { commissionId: number; posts: { id: number; title: string }[] }) {
  const [state, action, pending] = useActionState(claimCommission.bind(null, commissionId), {});
  if (posts.length === 0) {
    return <p className="text-xs text-muted">Para entregares, publica primeiro um post sobre o tema.</p>;
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {state.error && <p className="w-full text-xs font-semibold text-scoop">{state.error}</p>}
      <select name="post_id" required className={`${input} max-w-full text-sm`}>
        {posts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <button disabled={pending} className="bg-ink px-3 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-50">
        Entregar
      </button>
    </form>
  );
}
