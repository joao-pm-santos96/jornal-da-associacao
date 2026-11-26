"use client";

import { useActionState, useState, useTransition } from "react";
import { buyNickname, buyPardon, giveGrains } from "@/app/economia-actions";
import { grantAmnesty } from "@/app/governo-actions";
import type { FormState } from "@/lib/form";
import { grains } from "@/lib/grains";

const input = "border-2 border-ink bg-white p-1.5";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>;
  if (state.ok) return <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>;
  return null;
}

export function PardonButton({ price }: { price: number }) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Feedback state={state} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Comprar o indulto da escala desta semana por ${price} ☕? Não há multa, mas também não há pontos da escala.`)) return;
          start(async () => setState(await buyPardon()));
        }}
        className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50"
      >
        Comprar indulto ({price} ☕)
      </button>
    </div>
  );
}

export function NicknameForm({ members, price, days }: { members: { id: number; name: string }[]; price: number; days: number }) {
  const [state, action, pending] = useActionState(buyNickname, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="nick-user" className="block text-xs font-semibold">Sócio</label>
          <select id="nick-user" name="user_id" required className={input}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="nick-text" className="block text-xs font-semibold">Alcunha</label>
          <input id="nick-text" name="nickname" required minLength={2} maxLength={30} placeholder="ex.: o Magnífico" className={`${input} w-full`} />
        </div>
      </div>
      <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
        Pôr alcunha ({price} ☕, {days} dias)
      </button>
    </form>
  );
}

export function GiftForm({ members, balance, reasonMax }: { members: { id: number; name: string }[]; balance: number; reasonMax: number }) {
  const [state, action, pending] = useActionState(giveGrains, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="gift-user" className="block text-xs font-semibold">Para</label>
          <select id="gift-user" name="user_id" required className={input}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="gift-amount" className="block text-xs font-semibold">Quantia (☕)</label>
          <input id="gift-amount" name="amount" type="number" required min={1} max={Math.max(balance, 1)} step={1} className={`${input} w-24`} />
        </div>
      </div>
      <div>
        <label htmlFor="gift-reason" className="block text-xs font-semibold">Motivo</label>
        <input id="gift-reason" name="reason" required minLength={2} maxLength={reasonMax} placeholder="ex.: pelo jantar de ontem" className={`${input} w-full`} />
      </div>
      <button disabled={pending || balance <= 0} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
        Dar grãos
      </button>
    </form>
  );
}

export function AmnestyForm({ debtors }: { debtors: { id: number; name: string; balance: number }[] }) {
  const [state, action, pending] = useActionState(grantAmnesty, {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="amnesty-user" className="block text-xs font-semibold">Perdoar a dívida de</label>
          <select id="amnesty-user" name="user_id" className={input}>
            <option value="todos">Todos os devedores</option>
            {debtors.map((d) => <option key={d.id} value={d.id}>{d.name} ({grains(d.balance)} ☕)</option>)}
          </select>
        </div>
        <button disabled={pending} className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50">
          Decretar amnistia
        </button>
      </div>
    </form>
  );
}
