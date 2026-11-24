"use client";

import { useActionState } from "react";
import { appointTreasurer } from "@/app/governo-actions";

export function TreasurerForm({ members, current }: { members: { id: number; name: string }[]; current: number | null }) {
  const [state, action, pending] = useActionState(appointTreasurer, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Publicar o decreto de nomeação ou exoneração do Tesoureiro?")) e.preventDefault();
      }}
      className="space-y-2"
    >
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="treasurer" className="block text-xs font-semibold">💰 Tesoureiro</label>
          <select id="treasurer" name="user_id" defaultValue={current ?? ""} className="border-2 border-ink bg-white p-1.5">
            <option value="">— exonerar (cargo vago) —</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button disabled={pending} className="bg-ink px-3 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          Decretar
        </button>
      </div>
      <p className="text-xs text-muted">Sai um decreto presidencial e entra em vigor de imediato. O Presidente não pode nomear-se a si próprio.</p>
    </form>
  );
}
