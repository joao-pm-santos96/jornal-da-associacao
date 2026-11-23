"use client";

import { useActionState } from "react";
import { DUCKS } from "@/lib/ducks-table";
import { placeDuckBet } from "./actions";

export function DuckBetForm({ raceId, balance }: { raceId: number; balance: number }) {
  const [state, action, pending] = useActionState(placeDuckBet.bind(null, raceId), {});
  if (balance <= 0) {
    return <p className="text-sm">Sem saldo positivo não há apostas. Tens {balance} ☕.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold text-ink">{state.ok}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="duck" className="block text-xs font-semibold">Pato</label>
          <select id="duck" name="duck" required className="border-2 border-ink bg-white p-1.5 text-ink">
            {DUCKS.map((d) => <option key={d.n} value={d.n}>{d.n}. {d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="duck-amount" className="block text-xs font-semibold">Grãos (tens {balance} ☕)</label>
          <input id="duck-amount" name="amount" type="number" min={1} max={balance} step={1} required defaultValue={Math.min(5, balance)}
            className="w-28 border-2 border-ink bg-white p-1.5 text-ink" />
        </div>
        <button disabled={pending} className="border-2 border-ink bg-scoop px-4 py-2 text-sm font-black uppercase text-white shadow-[3px_3px_0_#141414] disabled:opacity-50">
          Apostar
        </button>
      </div>
    </form>
  );
}
