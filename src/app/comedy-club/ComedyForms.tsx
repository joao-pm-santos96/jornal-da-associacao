"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteJoke, setComedySchedule, submitJoke, voteJoke } from "./actions";
import type { FormState } from "@/lib/form";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>;
  if (state.ok) return <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>;
  return null;
}

export function JokeForm({ current, max }: { current: string | null; max: number }) {
  const [state, action, pending] = useActionState(submitJoke, {});
  const [deleting, startDelete] = useTransition();
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <textarea name="body" required minLength={3} maxLength={max} rows={4} defaultValue={current ?? ""}
        placeholder="Um padre, um tesoureiro e um pato entram num bar…" className="w-full border-2 border-ink bg-white p-2" />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          {current ? "Guardar alterações" : "🎤 Entregar a piada"}
        </button>
        {current && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm("Retirar a tua piada desta semana?")) startDelete(() => deleteJoke());
            }}
            className="text-sm text-scoop underline disabled:opacity-50"
          >
            Retirar
          </button>
        )}
      </div>
    </form>
  );
}

export function VoteButton({ jokeId, chosen }: { jokeId: number; chosen: boolean }) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending || chosen}
        onClick={() => start(async () => setState(await voteJoke(jokeId)))}
        className={`px-3 py-1.5 text-sm font-bold uppercase ${chosen ? "bg-flash text-ink" : "bg-ink text-white"} disabled:opacity-80`}
      >
        {chosen ? "✅ O teu voto" : "😂 Votar nesta"}
      </button>
      {state.error && <p className="text-xs font-semibold text-scoop">{state.error}</p>}
    </div>
  );
}

export function ScheduleForm({ day, opens, closes, days }: { day: number; opens: number; closes: number; days: readonly string[] }) {
  const [state, action, pending] = useActionState(setComedySchedule, {});
  const select = "border-2 border-ink bg-white p-1.5";
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="cc-day" className="block text-xs font-semibold">Dia</label>
          <select id="cc-day" name="day" defaultValue={day} className={select}>
            {days.map((d, i) => <option key={d} value={i + 1}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cc-opens" className="block text-xs font-semibold">Abre às</label>
          <select id="cc-opens" name="opens" defaultValue={opens} className={select}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cc-closes" className="block text-xs font-semibold">Fecha às</label>
          <select id="cc-closes" name="closes" defaultValue={closes} className={select}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}h</option>)}
          </select>
        </div>
        <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          👑 Decretar
        </button>
      </div>
    </form>
  );
}
