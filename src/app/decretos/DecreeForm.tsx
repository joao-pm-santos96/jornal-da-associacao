"use client";

import { useActionState } from "react";
import { createDecree } from "@/app/governo-actions";

export function DecreeForm() {
  const [state, action, pending] = useActionState(createDecree, {});
  const input = "w-full border-2 border-ink bg-white p-2";
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <div>
        <label htmlFor="decree-title" className="text-sm font-semibold">Título</label>
        <input id="decree-title" name="title" required maxLength={120}
          placeholder="ex.: É proibido falar de futebol antes da sobremesa" className={`${input} font-display text-lg font-bold`} />
      </div>
      <div>
        <label htmlFor="decree-body" className="text-sm font-semibold">Texto do decreto</label>
        <textarea id="decree-body" name="body" required maxLength={2000} rows={5}
          placeholder="Considerando que… Decreta-se que…" className={input} />
      </div>
      <button disabled={pending} className="bg-scoop px-4 py-2 font-bold uppercase text-white disabled:opacity-50">
        Decretar
      </button>
    </form>
  );
}
