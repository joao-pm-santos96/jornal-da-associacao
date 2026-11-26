import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEditions } from "@/lib/posts";
import { editionLabel } from "@/lib/dates";

export default async function ArchivePage() {
  await requireUser();
  const editions = await listEditions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="border-b-4 border-ink pb-3">
        <h1 className="font-display text-4xl font-black sm:text-5xl">Arquivo</h1>
        <p className="text-muted">Todas as edições do jornal, da mais recente à mais antiga.</p>
      </header>
      {editions.length === 0 ? (
        <p className="text-muted">Ainda não saiu nenhuma edição.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {editions.map((e, i) => (
            <li key={e.edition}>
              <Link href={i === 0 ? "/" : `/edicao/${e.edition}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-scoop">
                <span className="font-display text-xl font-bold">
                  {editionLabel(e.edition)}
                  {i === 0 && (
                    <span className="ml-2 align-middle bg-flash px-1.5 py-0.5 font-sans text-[10px] font-black uppercase tracking-widest text-ink">
                      Em banca
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted">{e.post_count === 1 ? "1 post" : `${e.post_count} posts`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
