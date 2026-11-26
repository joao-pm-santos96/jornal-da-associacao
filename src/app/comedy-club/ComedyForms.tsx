"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteJoke, submitJoke, voteJoke } from "./actions";
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
