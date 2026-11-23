"use client";

import { useActionState } from "react";
import { applyMovement } from "@/app/governo-actions";

export function MovementForm({ members }: { members: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(applyMovement, {});
  const input = "border-2 border-ink bg-white p-1.5";
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="mv-user" className="block text-xs font-semibold">Sócio</label>
          <select id="mv-user" name="user_id" required className={input}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mv-kind" className="block text-xs font-semibold">Tipo</label>
          <select id="mv-kind" name="kind" className={input}>
            <option value="multa">Multa</option>
            <option value="subsidio">Subsídio</option>
          </select>
        </div>
        <div>
          <label htmlFor="mv-amount" className="block text-xs font-semibold">Tremoços</label>
          <input id="mv-amount" name="amount" type="number" min={1} step={1} required defaultValue={5}
            className={`${input} w-28`} />
        </div>
      </div>
      <div>
        <label htmlFor="mv-reason" className="block text-xs font-semibold">Motivo</label>
        <input id="mv-reason" name="reason" required minLength={3} maxLength={140}
          placeholder="ex.: erro ortográfico grave na manchete" className={`${input} w-full`} />
      </div>
      <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
        Registar no livro
      </button>
    </form>
  );
}
