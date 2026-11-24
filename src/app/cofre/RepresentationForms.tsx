"use client";

import { useActionState, useState, useTransition } from "react";
import { denounce, launder, requestAudit, spendRepresentation } from "@/app/representacao-actions";
import type { FormState } from "@/lib/form";

const input = "border-2 border-ink bg-white p-1.5";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>;
  if (state.ok) return <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>;
  return null;
}

export function RepresentationForm({ excuses, max, done }: { excuses: readonly string[]; max: number; done: boolean }) {
  const [state, action, pending] = useActionState(spendRepresentation, {});
  if (done) return state.ok ? <Feedback state={state} /> : <p className="text-sm font-semibold">Já justificaste uma despesa esta semana.</p>;
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="rep-amount" className="block text-xs font-semibold">Grãos</label>
          <input id="rep-amount" name="amount" type="number" min={1} max={Math.max(max, 1)} step={1} required
            defaultValue={Math.max(Math.min(max, 5), 1)} className={`${input} w-24`} />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="rep-excuse" className="block text-xs font-semibold">Justificação</label>
          <select id="rep-excuse" name="excuse" className={`${input} w-full`}>
            {excuses.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>
      <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
        Justificar despesa
      </button>
    </form>
  );
}

export function LaunderForm({ left }: { left: number }) {
  const [state, action, pending] = useActionState(launder, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="wash-amount" className="block text-xs font-semibold">Grãos</label>
          <input id="wash-amount" name="amount" type="number" min={1} max={Math.max(left, 1)} step={1} required
            defaultValue={Math.max(left, 1)} className={`${input} w-24`} />
        </div>
        <button disabled={pending || left < 1} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          Passar como «consultoria»
        </button>
      </div>
    </form>
  );
}

function OneShot({ label, question, run, className, done }: { label: string; question: string; run: () => Promise<FormState>; className: string; done?: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  if (done) return state.ok || state.error ? <Feedback state={state} /> : <p className="text-sm font-semibold">{done}</p>;
  return (
    <div className="space-y-2">
      <Feedback state={state} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(question)) return;
          start(async () => setState(await run()));
        }}
        className={`${className} disabled:opacity-50`}
      >
        {label}
      </button>
    </div>
  );
}

export function AuditButton({ cost, done }: { cost: number; done: boolean }) {
  return (
    <OneShot
      label={`🔍 Pedir auditoria (${cost} ☕)`}
      question={`Pagar ${cost} ☕ por uma auditoria às contas do governo? Se não encontrar nada, não há reembolso.`}
      run={requestAudit}
      done={done ? "Já pediste uma auditoria esta semana." : undefined}
      className="border-2 border-ink bg-white px-4 py-2 text-sm font-bold uppercase hover:bg-ink hover:text-white"
    />
  );
}

export function DenounceButton({ done }: { done: boolean }) {
  return (
    <OneShot
      label="🐀 Denunciar à Judiciária"
      question="Fazer uma denúncia anónima? Se houver outro saco azul no Cofre, ficas com metade e esta semana as auditorias não te tocam."
      run={denounce}
      done={done ? "Já denunciaste esta semana." : undefined}
      className="border-2 border-scoop bg-white px-4 py-2 text-sm font-bold uppercase text-scoop hover:bg-scoop hover:text-white"
    />
  );
}
