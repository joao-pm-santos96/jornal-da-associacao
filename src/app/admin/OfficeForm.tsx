"use client";

import { useActionState } from "react";
import { setOffice } from "@/app/governo-actions";

const OFFICES = [
  { office: "presidente", label: "👑 Presidente" },
  { office: "tesoureiro", label: "💰 Tesoureiro" },
] as const;

type Office = (typeof OFFICES)[number]["office"];

type Props = {
  users: { id: number; name: string }[];
  current: Partial<Record<Office, number>>;
};

export function OfficeForm({ users, current }: Props) {
  const [state, action, pending] = useActionState(setOffice, {});
  return (
    <div className="space-y-3">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
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
        </form>
      ))}
    </div>
  );
}
