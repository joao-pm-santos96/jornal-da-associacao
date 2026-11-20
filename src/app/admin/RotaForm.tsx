"use client";

import { useActionState } from "react";
import { setRotaSlot } from "./actions";

export function RotaForm({ users, nextMonday }: { users: { id: number; name: string }[]; nextMonday: string }) {
  const [state, action, pending] = useActionState(setRotaSlot, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="week_start" className="block text-xs font-semibold">Segunda-feira da semana</label>
          <input id="week_start" type="date" name="week_start" defaultValue={nextMonday} required
            className="border-2 border-ink bg-white p-1.5" />
        </div>
        <div>
          <label htmlFor="user_id" className="block text-xs font-semibold">Quem escreve</label>
          <select id="user_id" name="user_id" required className="border-2 border-ink bg-white p-1.5">
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <button disabled={pending} className="bg-ink px-3 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          Guardar
        </button>
      </div>
      <p className="text-xs text-muted">Se a semana já existir, troca a pessoa.</p>
    </form>
  );
}
