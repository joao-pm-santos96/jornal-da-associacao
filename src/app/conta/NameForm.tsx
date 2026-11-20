"use client";

import { useActionState } from "react";
import { changeName } from "@/app/actions";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(changeName, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <p className="border-2 border-scoop bg-white p-3 font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-3 font-semibold">{state.ok}</p>}
      <div>
        <label htmlFor="name" className="text-sm font-semibold">Nome (aparece nos posts e comentários)</label>
        <input id="name" name="name" defaultValue={name} required maxLength={60}
          className="w-full border-2 border-ink bg-white p-2" />
      </div>
      <button disabled={pending} className="bg-ink px-4 py-2 font-bold uppercase text-white disabled:opacity-50">
        Mudar nome
      </button>
    </form>
  );
}
