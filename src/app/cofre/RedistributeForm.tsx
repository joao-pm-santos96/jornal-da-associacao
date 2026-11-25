"use client";

import { useActionState, useState } from "react";
import { redistribute } from "@/app/governo-actions";

const input = "border-2 border-ink bg-white p-1.5";

export function RedistributeForm({ available, members }: { available: number; members: number }) {
  const [state, action, pending] = useActionState(redistribute, {});
  const [mode, setMode] = useState<"pct" | "total">("pct");
  const [value, setValue] = useState(10);
  const total = mode === "pct" ? Math.floor((available * Math.min(Math.max(value, 0), 100)) / 100) : value;
  const share = members > 0 && total <= available ? Math.floor(total / members) : 0;
  return (
    <form action={action} className="space-y-2">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="rd-mode" className="block text-xs font-semibold">Quanto</label>
          <select id="rd-mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value === "total" ? "total" : "pct")} className={input}>
            <option value="pct">% do disponível</option>
            <option value="total">☕ no total</option>
          </select>
        </div>
        <div>
          <label htmlFor="rd-value" className="block text-xs font-semibold">{mode === "pct" ? "%" : "Grãos"}</label>
          <input id="rd-value" name="value" type="number" min={1} max={mode === "pct" ? 100 : Math.max(available, 1)} step={1} required
            value={Number.isNaN(value) ? "" : value} onChange={(e) => setValue(e.target.valueAsNumber)} className={`${input} w-24`} />
        </div>
        <p className="pb-2 text-sm font-semibold">
          {share > 0 ? `= ${share} ☕ a cada um (${share * members} ☕)` : "não chega para 1 ☕ a cada um"}
        </p>
      </div>
      <div>
        <label htmlFor="rd-reason" className="block text-xs font-semibold">Motivo</label>
        <input id="rd-reason" name="reason" required minLength={3} maxLength={140}
          placeholder="ex.: dividendos do casino" className={`${input} w-full`} />
      </div>
      <button
        disabled={pending || share < 1}
        onClick={(e) => {
          if (!confirm(`Distribuir ${share * members} ☕ do Cofre (${share} ☕ a cada sócio)? Sai um despacho público.`)) e.preventDefault();
        }}
        className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50"
      >
        Distribuir
      </button>
    </form>
  );
}
