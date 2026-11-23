"use client";

import { useActionState, useState } from "react";
import { MOVES, type Move } from "@/lib/duels-table";
import type { FormState } from "@/lib/form";
import { challenge, respondDuel } from "./actions";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>;
  if (state.ok) return <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold text-ink">{state.ok}</p>;
  return null;
}

function MovePicker({ value, onChange }: { value: Move | null; onChange: (m: Move) => void }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Jogada">
      {MOVES.map((m) => (
        <button
          key={m.move}
          type="button"
          role="radio"
          aria-checked={value === m.move}
          onClick={() => onChange(m.move)}
          className={`flex flex-1 flex-col items-center border-2 border-ink py-2 text-xs font-black uppercase ${
            value === m.move ? "bg-[#f2c230] text-ink" : "bg-white text-ink"
          }`}
        >
          <span className="text-3xl">{m.emoji}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function ChallengeForm({ members, balance }: { members: { id: number; name: string }[]; balance: number }) {
  const [state, action, pending] = useActionState(challenge, {});
  const [move, setMove] = useState<Move | null>(null);
  if (balance < 2) return <p className="text-sm">Um duelo é de pelo menos 2 ☕ e tens {balance} ☕.</p>;
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <div className="flex flex-wrap gap-2">
        <div>
          <label htmlFor="duel-opponent" className="block text-xs font-semibold">Adversário</label>
          <select id="duel-opponent" name="opponent_id" required className="border-2 border-ink bg-white p-1.5 text-ink">
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="duel-stake" className="block text-xs font-semibold">Grãos em jogo (tens {balance} ☕)</label>
          <input id="duel-stake" name="stake" type="number" min={2} max={balance} step={1} required defaultValue={Math.min(5, balance)}
            className="w-28 border-2 border-ink bg-white p-1.5 text-ink" />
        </div>
      </div>
      <input type="hidden" name="move" value={move ?? ""} />
      <MovePicker value={move} onChange={setMove} />
      <button disabled={pending || !move} className="w-full border-2 border-ink bg-scoop py-2 text-sm font-black uppercase text-white shadow-[3px_3px_0_#141414] disabled:opacity-50">
        ⚔️ Lançar o desafio
      </button>
    </form>
  );
}

export function RespondForm({ duelId }: { duelId: number }) {
  const [state, action, pending] = useActionState(respondDuel.bind(null, duelId), {});
  const [move, setMove] = useState<Move | null>(null);
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      {!state.ok && !state.error && (
        <>
          <input type="hidden" name="move" value={move ?? ""} />
          <MovePicker value={move} onChange={setMove} />
          <button disabled={pending || !move} className="w-full border-2 border-ink bg-ink py-2 text-sm font-black uppercase text-white disabled:opacity-50">
            Aceitar e jogar
          </button>
        </>
      )}
    </form>
  );
}
