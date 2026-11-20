"use client";

import type { CredentialsState } from "./actions";

export function Credentials({ state }: { state: CredentialsState }) {
  if (state.error) return <p className="border-2 border-scoop bg-white p-3 font-semibold text-scoop">{state.error}</p>;
  if (!state.password) return null;

  const origin = window.location.origin;
  const message = `Olá! Tens conta no Jornal da Associação: ${origin}\nUtilizador: ${state.username}\nPassword temporária: ${state.password}\nDepois de entrares, muda a password em ${origin}/conta`;
  return (
    <div className="space-y-2 border-2 border-ink bg-flash p-3">
      <p className="font-semibold">{state.ok} Copia já: a password não volta a aparecer.</p>
      <textarea readOnly value={message} rows={5} onFocus={(e) => e.currentTarget.select()}
        className="w-full border border-ink bg-white p-2 font-mono text-xs" />
      <button type="button" onClick={() => navigator.clipboard.writeText(message)}
        className="bg-ink px-3 py-1 text-xs font-bold uppercase text-white">Copiar mensagem</button>
    </div>
  );
}
