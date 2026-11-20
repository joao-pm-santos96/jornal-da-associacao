"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions";
import { Markdown } from "./Markdown";

type Initial = { title: string; body: string; edition: string; publishAt: string };

export function PostEditor({
  action,
  initial,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial: Initial;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [body, setBody] = useState(initial.body);
  const [preview, setPreview] = useState(false);
  const input = "w-full border-2 border-ink bg-white p-2";

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <p className="border-2 border-scoop bg-white p-3 font-semibold text-scoop">{state.error}</p>}

      <div>
        <label htmlFor="title" className="text-sm font-semibold">Título</label>
        <input id="title" name="title" defaultValue={initial.title} required maxLength={200}
          className={`${input} font-display text-2xl font-bold`} />
      </div>

      <div>
        <label htmlFor="edition" className="text-sm font-semibold">Edição (AAAA-MM)</label>
        <input id="edition" name="edition" defaultValue={initial.edition} required pattern="\d{4}-(0[1-9]|1[0-2])"
          className={`${input} max-w-40`} />
      </div>

      <div>
        <div className="flex gap-1 text-sm font-semibold">
          <button type="button" onClick={() => setPreview(false)}
            className={`px-3 py-1 ${preview ? "" : "bg-ink text-white"}`}>Escrever</button>
          <button type="button" onClick={() => setPreview(true)}
            className={`px-3 py-1 ${preview ? "bg-ink text-white" : ""}`}>Pré-visualizar</button>
        </div>
        <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} required maxLength={50000}
          rows={18} placeholder="Escreve em Markdown. Imagens: ![descrição](https://…)"
          className={`${input} font-mono text-sm ${preview ? "hidden" : ""}`} />
        {preview && (
          <div className="min-h-64 border-2 border-ink bg-white p-4">
            {body.trim() ? <Markdown>{body}</Markdown> : <p className="text-muted">Nada para mostrar.</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t-2 border-ink pt-4 sm:flex-row sm:flex-wrap sm:items-end">
        <button name="intent" value="draft" disabled={pending}
          className="border-2 border-ink px-4 py-2 font-bold uppercase disabled:opacity-50">Guardar rascunho</button>
        <button name="intent" value="publish" disabled={pending}
          className="bg-scoop px-4 py-2 font-bold uppercase text-white disabled:opacity-50">Publicar agora</button>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="publish_at" className="block text-xs font-semibold">Data e hora (Lisboa)</label>
            <input id="publish_at" type="datetime-local" name="publish_at" defaultValue={initial.publishAt}
              className="border-2 border-ink bg-white p-1.5" />
          </div>
          <button name="intent" value="schedule" disabled={pending}
            className="bg-flash px-4 py-2 font-bold uppercase disabled:opacity-50">Agendar</button>
        </div>
      </div>
    </form>
  );
}
