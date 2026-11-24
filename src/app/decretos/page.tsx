import { requireUser } from "@/lib/auth";
import { decreeKind, listDecrees } from "@/lib/decrees";
import { getOffices } from "@/lib/offices";
import { formatDateTime } from "@/lib/dates";
import { ConfirmButton } from "@/components/ConfirmButton";
import { revokeDecree } from "@/app/governo-actions";
import { DecreeForm } from "./DecreeForm";
import { TreasurerForm } from "./TreasurerForm";
import { RotaForm } from "../admin/RotaForm";
import { removeRotaSlot } from "../admin/actions";
import { sql } from "@/lib/db";
import { getRota } from "@/lib/rota";
import { addDays, weekOf } from "@/lib/economy";
import { getNow } from "@/lib/seasons";

export default async function DecreesPage() {
  const user = await requireUser();
  const [decrees, offices] = await Promise.all([listDecrees(), getOffices()]);
  const isPresident = offices.presidente?.user_id === user.id;
  const thisWeek = weekOf(await getNow());
  const [memberRows, rota] = isPresident ? await Promise.all([sql`SELECT id, name FROM users ORDER BY name`, getRota()]) : [[], []];
  const members = memberRows as { id: number; name: string }[];
  const upcoming = rota.filter((s) => s.week_start >= thisWeek);

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
          <div className="mt-6 space-y-3 border-t-2 border-dashed border-ink pt-4">
            <h3 className="font-display text-xl font-black">Governo</h3>
            <TreasurerForm members={members.filter((m) => m.id !== user.id)} current={offices.tesoureiro?.user_id ?? null} />
          </div>
          <div className="mt-6 space-y-3 border-t-2 border-dashed border-ink pt-4">
            <h3 className="font-display text-xl font-black">✍️ Escala de escrita</h3>
            <p className="text-xs text-muted">Desta semana em diante. Quem for escalado recebe um aviso.</p>
            <RotaForm users={members} nextMonday={addDays(thisWeek, 7)} />
            {upcoming.length > 0 && (
              <ul className="divide-y divide-rule">
                {upcoming.map((s) => (
                  <li key={s.week_start} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="text-muted">{s.week_start}</span> · <strong>{s.name}</strong>
                    </span>
                    <form action={removeRotaSlot.bind(null, s.week_start)}>
                      <ConfirmButton message={`Tirar a semana de ${s.week_start} da escala?`} className="text-xs text-scoop underline">
                        Remover
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
