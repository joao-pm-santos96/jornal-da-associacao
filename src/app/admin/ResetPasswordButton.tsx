"use client";

import { useActionState } from "react";
import { resetPassword } from "./actions";
import { Credentials } from "./Credentials";

export function ResetPasswordButton({ userId, username }: { userId: number; username: string }) {
  const [state, action, pending] = useActionState(() => resetPassword(userId), {});
  return (
    <div className="space-y-2">
      <form action={action}>
        <button disabled={pending} className="text-xs font-semibold text-scoop underline disabled:opacity-50"
          onClick={(e) => {
            if (!confirm(`Gerar uma nova password temporária para @${username}? A atual deixa de funcionar.`)) e.preventDefault();
          }}>
          Nova password
        </button>
      </form>
      <Credentials state={state} />
    </div>
  );
}
