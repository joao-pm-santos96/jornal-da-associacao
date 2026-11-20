import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listPending } from "@/lib/posts";
import { editionLabel, formatDateTime } from "@/lib/dates";

export default async function PendingPage() {
  const user = await requireUser();
  const posts = await listPending(user);
  return (
    <div>
      <h1 className="font-display text-4xl font-black">Na gaveta</h1>
      <p className="mb-6 mt-1 text-muted">
        Rascunhos e posts agendados{user.is_admin ? " (como admin, vês os de todos)" : ""}.
      </p>
      {posts.length === 0 ? (
        <p>
          Nada pendente. <Link href="/novo" className="font-semibold text-scoop underline">Escrever um post</Link>
        </p>
      ) : (
        <ul className="divide-y divide-rule border-y-2 border-ink">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <div>
                <Link href={`/post/${p.id}`} className="font-display text-xl font-bold hover:text-scoop">{p.title}</Link>
                <p className="text-xs text-muted">
                  {editionLabel(p.edition)}
                  {user.is_admin && <> · {p.author_name}</>}
                </p>
              </div>
              {p.status === "draft" || !p.publish_at ? (
                <span className="bg-ink px-2 py-0.5 text-xs font-bold uppercase text-white">Rascunho</span>
              ) : (
                <span className="bg-flash px-2 py-0.5 text-xs font-bold uppercase">Sai a {formatDateTime(p.publish_at)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
