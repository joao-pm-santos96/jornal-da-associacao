import { requireUser } from "@/lib/auth";
import { decreeKind, listDecrees } from "@/lib/decrees";
import { getOffices } from "@/lib/offices";
import { formatDateTime } from "@/lib/dates";
import { ConfirmButton } from "@/components/ConfirmButton";
import { revokeDecree } from "@/app/governo-actions";
import { DecreeForm } from "./DecreeForm";

export default async function DecreesPage() {
  const user = await requireUser();
  const [decrees, offices] = await Promise.all([listDecrees(), getOffices()]);
  const isPresident = offices.presidente?.user_id === user.id;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">Decretos e despachos</h1>
        <p className="text-muted">
          Presidente em funções: <strong>{offices.presidente?.name ?? "cargo vago"}</strong>. Tesoureiro: <strong>{offices.tesoureiro?.name ?? "cargo vago"}</strong>. Cumpra-se.
        </p>
      </header>

      {isPresident && (
        <section id="gabinete" className="max-w-2xl scroll-mt-4 border-2 border-ink bg-white p-4">
          <h2 className="mb-3 font-display text-2xl font-black">👑 Gabinete da Presidência</h2>
          <DecreeForm />
        </section>
      )}

      <section className="space-y-6">
        {decrees.length === 0 && <p className="text-muted">Ainda não há decretos. Reina a anarquia.</p>}
        {decrees.map((d) => (
          <article key={d.id} className={`relative border-4 border-double border-ink bg-white p-4 ${d.revoked_at ? "opacity-70" : ""}`}>
            {d.revoked_at && (
              <span className="absolute right-3 top-3 -rotate-6 border-4 border-scoop px-2 py-0.5 font-display text-2xl font-black uppercase text-scoop">
                Revogado
              </span>
            )}
            <p className="text-xs font-black uppercase tracking-widest text-scoop">
              {decreeKind(d.office)} n.º {d.number}/{d.year} · {formatDateTime(d.created_at)}
            </p>
            <h2 className="mt-1 font-display text-2xl font-black leading-tight">{d.title}</h2>
            <p className="mt-2 whitespace-pre-wrap">{d.body}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>Assinado: {d.author}</span>
              {isPresident && d.office === "presidente" && !d.revoked_at && (
                <form action={revokeDecree.bind(null, d.id)}>
                  <ConfirmButton message="Revogar este decreto?" className="text-scoop underline">Revogar</ConfirmButton>
                </form>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
