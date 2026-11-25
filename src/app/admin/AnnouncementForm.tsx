"use client";

import { useActionState } from "react";
import { sendAnnouncement } from "./actions";

const input = "w-full border-2 border-ink bg-white p-1.5";

export function AnnouncementForm() {
  const [state, action, pending] = useActionState(sendAnnouncement, {});
  return (
    <form action={action} className="max-w-xl space-y-2">
      {state.error && <p className="border-2 border-scoop bg-white p-2 text-sm font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{state.ok}</p>}
      <div>
        <label htmlFor="ann-title" className="block text-xs font-semibold">Título (com emoji, se quiseres)</label>
        <input id="ann-title" name="title" required minLength={3} maxLength={80} placeholder="ex.: 🎲 Fumo branco!" className={input} />
      </div>
      <div>
        <label htmlFor="ann-body" className="block text-xs font-semibold">Texto</label>
        <textarea id="ann-body" name="body" required minLength={3} maxLength={300} rows={2} className={input} />
      </div>
      <button
        disabled={pending}
        onClick={(e) => {
          if (!confirm("Enviar este aviso a todos os sócios?")) e.preventDefault();
        }}
        className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50"
      >
        📣 Enviar a todos
      </button>
    </form>
  );
}
