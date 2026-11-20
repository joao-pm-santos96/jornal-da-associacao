import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { CreateUserForm } from "./CreateUserForm";
import { ResetPasswordButton } from "./ResetPasswordButton";

type Row = { id: number; username: string; name: string; is_admin: boolean; created_at: Date };

export default async function AdminPage() {
  const user = await requireUser();
  if (!user.is_admin) notFound();
  const users = (await sql`SELECT id, username, name, is_admin, created_at FROM users ORDER BY created_at`) as Row[];

  return (
    <div className="space-y-10">
      <section className="max-w-sm">
        <h1 className="mb-4 font-display text-3xl font-black">Nova conta</h1>
        <CreateUserForm />
      </section>
      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Contas ({users.length})</h2>
        <ul className="divide-y divide-rule">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div>
                <p className="font-display text-lg font-bold">
                  {u.name}
                  {u.is_admin && <span className="ml-2 bg-ink px-1.5 py-0.5 align-middle font-sans text-[10px] font-bold uppercase text-white">admin</span>}
                </p>
                <p className="text-xs text-muted">@{u.username} · desde {formatDateTime(u.created_at)}</p>
              </div>
              <ResetPasswordButton userId={u.id} username={u.username} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
