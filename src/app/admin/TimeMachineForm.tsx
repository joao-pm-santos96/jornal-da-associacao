"use client";

import { useActionState } from "react";
import { setFakeNow } from "@/app/festas-actions";

const PRESETS = [
  { label: "🎄 Natal (dia 5)", value: "2026-12-05T12:00" },
  { label: "🎅 Consoada (revelação)", value: "2026-12-24T21:00" },
  { label: "🥂 Meia-noite de 31", value: "2027-01-01T00:05" },
  { label: "🎭 Carnaval", value: "2027-02-07T12:00" },
  { label: "🎭 Cinzas", value: "2027-02-10T12:00" },
  { label: "🐰 Páscoa", value: "2027-03-28T12:00" },
];

export function TimeMachineForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(setFakeNow, {});
  return (
    <div className="space-y-3">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="fake_now" className="block text-xs font-semibold">Data e hora simulada (Ílhavo)</label>
          <input id="fake_now" name="fake_now" type="datetime-local" defaultValue={current}
            className="border-2 border-ink bg-white p-1.5" />
        </div>
        <button disabled={pending} className="bg-ink px-3 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          Viajar
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <form key={p.value} action={action}>
            <input type="hidden" name="fake_now" value={p.value} />
            <button disabled={pending} className="border-2 border-ink bg-white px-2 py-1 text-xs font-bold disabled:opacity-50">
              {p.label}
            </button>
          </form>
        ))}
        <form action={action}>
          <input type="hidden" name="fake_now" value="" />
          <button disabled={pending} className="border-2 border-scoop bg-white px-2 py-1 text-xs font-bold text-scoop disabled:opacity-50">
            Voltar ao presente
          </button>
        </form>
      </div>
      <p className="text-xs text-muted">
        Afeta só as épocas festivas (temas, Amigo Secreto, Advento, resoluções, disfarces, ovos e bónus), mas afeta-as para toda a gente. Em produção, deixa sempre desligada.
      </p>
    </div>
  );
}
