"use client";

import { useActionState } from "react";
import { sendSantaCard } from "@/app/festas-actions";

export function SantaCardForm({ to }: { to: string }) {
  const [state, action, pending] = useActionState(sendSantaCard, {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <label htmlFor="santa-card" className="text-sm font-semibold">Postal anónimo para {to}</label>
      <textarea id="santa-card" name="body" required maxLength={500} rows={3}
        placeholder="Querido amigo secreto…" className="w-full border-2 border-ink bg-white p-2" />
      <button disabled={pending} className="bg-scoop px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
        Enviar postal 🎅
      </button>
    </form>
  );
}
