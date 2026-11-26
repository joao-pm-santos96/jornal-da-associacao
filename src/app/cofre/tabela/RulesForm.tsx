"use client";

import { useActionState } from "react";
import { updateRules } from "@/app/regras-economia-actions";

export type RuleItem = { key: string; label: string; unit: string; value: number; min: number; max: number };
export type RuleGroup = { group: string; items: RuleItem[]; note?: string };

export function RulesForm({ groups }: { groups: RuleGroup[] }) {
  const [state, action, pending] = useActionState(updateRules, {});
  return (
    <form action={action} className="space-y-6">
      {groups.map((g) => (
        <fieldset key={g.group} className="border-2 border-ink bg-white p-4">
          <legend className="px-1 font-display text-xl font-black">{g.group}</legend>
          {g.note && <p className="mb-2 text-sm text-muted">{g.note}</p>}
          <div className="divide-y divide-rule">
            {g.items.map((r) => (
              <label key={r.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1">{r.label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <input
                    name={r.key}
                    type="number"
                    step={1}
                    min={r.min}
                    max={r.max}
                    defaultValue={r.value}
                    required
                    className="w-24 border-2 border-ink bg-white p-1 text-right font-bold"
                  />
                  <span className="w-20 text-xs text-muted">{r.unit}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="space-y-2 border-2 border-ink bg-white p-4">
        <label htmlFor="rules-reason" className="block font-bold">Justificação (opcional, sai no despacho)</label>
        <textarea id="rules-reason" name="reason" rows={3} maxLength={1000} className="w-full border-2 border-ink bg-white p-2"
          placeholder="ex.: Medidas de austeridade impostas pela troika do café." />
        {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
        {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
        <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          💰 Publicar despacho
        </button>
        <p className="text-xs text-muted">Entra em vigor de imediato e sai em /decretos, com aviso a todos os sócios.</p>
      </div>
    </form>
  );
}
