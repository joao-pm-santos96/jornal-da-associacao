"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  const input = "w-full border-2 border-ink bg-white p-2";
  return (
    <form action={action} className="space-y-4">
      {state.error && <p className="border-2 border-scoop bg-white p-3 font-semibold text-scoop">{state.error}</p>}
      {state.ok && <p className="border-2 border-ink bg-flash p-3 font-semibold">{state.ok}</p>}
      <div>
        <label htmlFor="current" className="text-sm font-semibold">Password atual</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={input} />
      </div>
      <div>
        <label htmlFor="next" className="text-sm font-semibold">Nova password</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} className={input} />
      </div>
      <div>
        <label htmlFor="confirm" className="text-sm font-semibold">Repete a nova password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className={input} />
      </div>
      <button disabled={pending} className="bg-ink px-4 py-2 font-bold uppercase text-white disabled:opacity-50">
        Mudar password
      </button>
    </form>
  );
}
