"use client";

import { useActionState } from "react";
import { createUser } from "./actions";
import { Credentials } from "./Credentials";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, {});
  const input = "w-full border-2 border-ink bg-white p-2";
  return (
    <form action={action} className="space-y-4">
      <Credentials state={state} />
      <div>
        <label htmlFor="username" className="text-sm font-semibold">Username (para entrar)</label>
        <input id="username" name="username" required pattern="[a-z0-9._\-]{2,32}" autoCapitalize="none"
          autoCorrect="off" spellCheck={false} placeholder="ex.: ze" className={input} />
      </div>
      <div>
        <label htmlFor="new-name" className="text-sm font-semibold">Nome no jornal</label>
        <input id="new-name" name="name" required maxLength={60} placeholder="ex.: Zé das Couves" className={input} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_admin" /> Admin
      </label>
      <button disabled={pending} className="bg-scoop px-4 py-2 font-bold uppercase text-white disabled:opacity-50">
        Criar conta
      </button>
    </form>
  );
}
