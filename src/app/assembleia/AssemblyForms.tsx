"use client";

import { startTransition, useActionState, useState } from "react";
import { addAssemblyComment, castVote, convene } from "./actions";
import type { FormState } from "@/lib/form";

const input = "border-2 border-ink bg-white p-1.5";
const button = "bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>;
  if (state.ok) return <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>;
  return null;
}

export function ConveneForm({ durations }: { durations: readonly { hours: number; label: string }[] }) {
  const [state, action, pending] = useActionState(convene, {});
  const [kind, setKind] = useState<"sim_nao" | "opcoes">("sim_nao");
  const [constitutional, setConstitutional] = useState(false);
  const [binding, setBinding] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <Feedback state={state} />
      <div>
        <label htmlFor="as-title" className="block text-xs font-semibold">Pergunta à Assembleia</label>
        <input id="as-title" name="title" required minLength={5} maxLength={140}
          placeholder="ex.: O jantar de Natal é no Tasco do Zé?" className={`${input} w-full`} />
      </div>
      <div>
        <label htmlFor="as-body" className="block text-xs font-semibold">Enquadramento (opcional)</label>
        <textarea id="as-body" name="body" maxLength={2000} rows={3} className={`${input} w-full`} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="as-kind" className="block text-xs font-semibold">Formato</label>
          <select id="as-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value === "opcoes" ? "opcoes" : "sim_nao")} className={input}>
            <option value="sim_nao">Sim / Não / Abstenção</option>
            <option value="opcoes">Escolher entre opções</option>
          </select>
        </div>
        <div>
          <label htmlFor="as-hours" className="block text-xs font-semibold">Duração</label>
          <select id="as-hours" name="hours" defaultValue={48} className={input}>
            {durations.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
          </select>
        </div>
      </div>
      {kind === "opcoes" && (
        <div>
          <label htmlFor="as-options" className="block text-xs font-semibold">Opções (uma por linha, 2 a 6)</label>
          <textarea id="as-options" name="options" required rows={4} className={`${input} w-full`} />
        </div>
      )}
      <fieldset className="space-y-1 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="secret" className="mt-1" />
          <span><strong>Voto secreto</strong>: só se conhecem os totais, e só quando fechar. Sem isto, quem votou em quê vê-se em tempo real.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="binding" checked={binding || constitutional} disabled={constitutional} onChange={(e) => setBinding(e.target.checked)} className="mt-1" />
          <span><strong>Vinculativa</strong>: se for aprovada, o governo tem de a cumprir. Sem isto, é só consultiva.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="constitutional" checked={constitutional} onChange={(e) => setConstitutional(e.target.checked)} className="mt-1" />
          <span><strong>Mexe na Constituição</strong>: precisa de 2/3 dos votos (sim ou não) e é sempre vinculativa.</span>
        </label>
      </fieldset>
      <button disabled={pending} className={button}>🗳️ Convocar a Assembleia</button>
    </form>
  );
}

export function VoteForm({ id, options, mine }: { id: number; options: { id: number; label: string }[]; mine: number | null }) {
  const [state, action, pending] = useActionState(castVote.bind(null, id), {});
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 border-2 border-ink bg-white px-3 py-2 font-semibold has-[:checked]:bg-flash">
            <input type="radio" name="option_id" value={o.id} required defaultChecked={o.id === mine} />
            {o.label}
            {o.id === mine && <span className="ml-auto text-xs font-bold uppercase text-scoop">o teu voto</span>}
          </label>
        ))}
      </div>
      <button disabled={pending} className={button}>{mine === null ? "Votar" : "Mudar o voto"}</button>
    </form>
  );
}

export function AssemblyCommentForm({ id }: { id: number }) {
  const [state, action, pending] = useActionState(addAssemblyComment.bind(null, id), {});
  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <textarea name="body" required maxLength={2000} rows={3} placeholder="Defende o teu voto…" className={`${input} w-full`} />
      <button disabled={pending} className={button}>Comentar</button>
    </form>
  );
}
