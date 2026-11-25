"use client";

import { useActionState } from "react";
import { setOffice } from "@/app/governo-actions";
import { sendOfficeLetter } from "@/app/representacao-actions";

const OFFICES = [
  { office: "presidente", label: "👑 Presidente" },
  { office: "tesoureiro", label: "💰 Tesoureiro" },
  { office: "apostas", label: "🎲 Gestor de Apostas" },
] as const;

type Office = (typeof OFFICES)[number]["office"];

type Props = {
  users: { id: number; name: string }[];
  current: Partial<Record<Office, number>>;
};

export function OfficeForm({ users, current }: Props) {
  const [appointed, action, pending] = useActionState(setOffice, {});
  const [sent, sendAction, sending] = useActionState(sendOfficeLetter, {});
  return (
    <div className="space-y-3">
      {[appointed, sent].map((state, i) => (
        <div key={i}>
          {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
          {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
        </div>
      ))}
      {OFFICES.map(({ office, label }) => (
        <form key={office} action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="office" value={office} />
          <div>
            <label htmlFor={`office-${office}`} className="block text-xs font-semibold">
              {label}
            </label>
            <select id={`office-${office}`} name="user_id" defaultValue={current[office] ?? ""}
              className="border-2 border-ink bg-white p-1.5">
              <option value="">— vago —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <button disabled={pending} className="bg-ink px-3 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
            Nomear
          </button>
          {office !== "apostas" && (
            <button formAction={sendAction} disabled={sending || !current[office]} title="Envia ao titular um push a dizer que tem correspondência no gabinete"
              className="border-2 border-ink px-3 py-1.5 text-sm font-bold uppercase disabled:opacity-50">
              📨 Avisar da carta
            </button>
          )}
        </form>
      ))}
    </div>
  );
}
