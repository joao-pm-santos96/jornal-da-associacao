"use client";

import { useActionState } from "react";
import { saveResolutions } from "@/app/festas-actions";

export function ResolutionForm({ year, current }: { year: number; current: string[] }) {
  const [state, action, pending] = useActionState(saveResolutions, {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <label htmlFor={`r${i}`} className="text-xs font-semibold">Resolução {i}</label>
          <input id={`r${i}`} name={`r${i}`} maxLength={200} defaultValue={current[i - 1] ?? ""}
            placeholder={i === 1 ? "ex.: ler todos os posts no próprio dia" : ""}
            className="w-full border-2 border-ink bg-white p-2" />
        </div>
      ))}
      <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
        Selar até dezembro de {year} 🔒
      </button>
    </form>
  );
}
