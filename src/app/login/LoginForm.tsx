"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  const input = "w-full border-2 border-ink bg-white p-2";
  return (
    <form action={action} className="space-y-4">
      {state.error && <p className="border-2 border-scoop bg-white p-3 font-semibold text-scoop">{state.error}</p>}
      <div>
        <label htmlFor="email" className="text-sm font-semibold">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={input} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-semibold">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
      </div>
      <button disabled={pending} className="w-full bg-scoop py-2 font-bold uppercase text-white disabled:opacity-50">
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
