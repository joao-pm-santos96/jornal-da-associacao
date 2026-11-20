import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getNow, getSeason, lisbon } from "@/lib/seasons";
import { getResolutions, resolutionYear, resolutionsRevealed } from "@/lib/festas/anonovo";
import { voteResolution } from "@/app/festas-actions";
import { ResolutionForm } from "./ResolutionForm";

export default async function ResolutionsPage() {
  const user = await requireUser();
  const [now, season] = await Promise.all([getNow(), getSeason()]);
  const target = resolutionYear(now);
  const canWrite = season === "anonovo";
  const years = ((await sql`SELECT DISTINCT year FROM resolutions ORDER BY year DESC`) as { year: number }[]).map(
    (r) => r.year,
  );
  const sealedYears = years.filter((y) => !resolutionsRevealed(y, now));
  const revealedYears = years.filter((y) => resolutionsRevealed(y, now));
  const [sealed, revealed] = await Promise.all([
    Promise.all(sealedYears.map(async (y) => ({ year: y, list: await getResolutions(y, user.id) }))),
    Promise.all(revealedYears.map(async (y) => ({ year: y, list: await getResolutions(y, user.id) }))),
  ]);
  const mine = sealed.find((s) => s.year === target)?.list.find((r) => r.user_id === user.id);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">🥂 Resoluções de Ano Novo</h1>
        <p className="text-muted">
          Cápsula do tempo: as resoluções ficam seladas até 1 de dezembro do ano a que se referem. Aí, os outros votam se as cumpriste.
        </p>
      </header>

      {canWrite ? (
        <section className="max-w-lg border-2 border-ink bg-white p-4">
          <h2 className="mb-3 font-display text-2xl font-black">As minhas resoluções para {target}</h2>
          <ResolutionForm year={target} current={mine ? mine.body.split("\n") : []} />
        </section>
      ) : (
        <p className="border-2 border-rule p-3 text-sm text-muted">
          As resoluções só se escrevem entre 27 de dezembro e 6 de janeiro. Até lá, faz por cumprir as que já selaste.
        </p>
      )}

      {sealed.map(({ year, list }) => (
        <section key={year}>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">🔒 Seladas para {year}</h2>
          <ul className="mt-2 space-y-1">
            {list.map((r) => (
              <li key={r.user_id}>
                <strong>{r.name}</strong> selou {r.body.split("\n").length} resolução(ões).
                {r.user_id === user.id && <span className="text-muted"> (as tuas: «{r.body.split("\n").join("», «")}»)</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {revealed.map(({ year, list }) => (
        <section key={year}>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">📜 Reveladas: {year}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {list.map((r) => (
              <article key={r.user_id} className="border-2 border-ink bg-white p-3">
                <h3 className="font-display text-xl font-black">{r.name}</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {r.body.split("\n").map((line) => <li key={line}>{line}</li>)}
                </ul>
                <p className="mt-2 text-sm">
                  Cumpriu? 👍 {r.kept} · 👎 {r.broken}
                </p>
                {r.user_id !== user.id && (
                  <div className="mt-1 flex gap-2">
                    <form action={voteResolution.bind(null, year, r.user_id, true)}>
                      <button className={`border px-2 py-0.5 text-sm ${r.my_vote === true ? "border-scoop font-bold" : "border-rule"}`}>👍 Cumpriu</button>
                    </form>
                    <form action={voteResolution.bind(null, year, r.user_id, false)}>
                      <button className={`border px-2 py-0.5 text-sm ${r.my_vote === false ? "border-scoop font-bold" : "border-rule"}`}>👎 Falhou</button>
                    </form>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      {years.length === 0 && !canWrite && <p className="text-muted">Ainda ninguém selou resoluções.</p>}
      <p className="text-sm">
        <Link href={`/retrospetiva/${lisbon(now).month === 12 ? lisbon(now).year : lisbon(now).year - 1}`} className="underline hover:text-scoop">
          Ver o ano em revista →
        </Link>
      </p>
    </div>
  );
}
