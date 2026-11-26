"use client";

import { useActionState } from "react";
import { challengePool } from "./actions";

const input = "border-2 border-[#141414] bg-[#fff6d6] p-1.5 text-[#141414]";

export function ChallengeForm({ members, minStake, balance }: { members: { id: number; name: string }[]; minStake: number; balance: number }) {
  const [state, action, pending] = useActionState(challengePool, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="border-2 border-[#e10600] bg-white p-2 text-sm font-semibold text-[#e10600]">{state.error}</p>}
      {state.ok && <p className="border-2 border-[#141414] bg-[#f2c230] p-2 text-sm font-semibold text-[#141414]">{state.ok}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="pool-opponent" className="block text-xs font-semibold">Adversário</label>
          <select id="pool-opponent" name="opponent_id" required className={input}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pool-stake" className="block text-xs font-semibold">Aposta (tens {balance} ☕)</label>
          <input id="pool-stake" name="stake" type="number" min={minStake} max={Math.max(balance, minStake)} step={1} defaultValue={minStake}
            className={`${input} w-28`} />
        </div>
        <button disabled={pending}
          className="border-4 border-[#141414] bg-[#e10600] px-4 py-1.5 font-display text-lg font-black uppercase text-[#f2c230] shadow-[3px_3px_0_#141414] disabled:opacity-50">
          🎱 Desafiar
        </button>
      </div>
      <p className="text-xs opacity-80">{minStake === 0 ? "Com 0 ☕ é uma partida amigável, só pela honra." : `A aposta mínima é de ${minStake} ☕.`}</p>
    </form>
  );
}
