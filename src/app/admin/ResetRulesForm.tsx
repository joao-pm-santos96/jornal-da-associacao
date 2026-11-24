"use client";

import { useActionState } from "react";
import { resetRules } from "@/app/regras-economia-actions";

export function ResetRulesForm({ changed }: { changed: number }) {
  const [state, action, pending] = useActionState(resetRules, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Repor todos os preços, taxas e percentagens nos valores de origem? Sai um despacho público.")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <p className="text-sm text-muted">
        {changed === 0
          ? "Todos os valores estão nos de origem."
          : `${changed} ${changed === 1 ? "valor foi mudado" : "valores foram mudados"} pelo Tesoureiro.`}{" "}
        O total em circulação não é tocado.
      </p>
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <button disabled={pending} className="bg-scoop px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
        🛠️ Repor os valores de origem
      </button>
    </form>
  );
}
