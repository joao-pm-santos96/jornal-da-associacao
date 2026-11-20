import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getNow, getSeason, lisbon } from "@/lib/seasons";
import { getReveal, lastCarnival } from "@/lib/festas/carnaval";

const dayLabel = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

export default async function CarnivalPage() {
  const user = await requireUser();
  const [now, season] = await Promise.all([getNow(), getSeason()]);
  const { days, over } = await lastCarnival(now);
  const today = lisbon(now).date;
  const myMask = season === "carnaval"
    ? ((await sql`
        SELECT mu.name FROM carnival_masks m JOIN users mu ON mu.id = m.mask_id
        WHERE m.day = ${today}::date AND m.user_id = ${user.id}
      `) as { name: string }[])[0]?.name
    : undefined;
  const reveal = over ? await getReveal(days) : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">🎭 É Carnaval, ninguém leva a mal</h1>
        <p className="text-muted">
          Durante o Carnaval toda a gente anda disfarçada: cada sócio aparece no jornal com o nome de outro, e os disfarces mudam todos os dias. Na Quarta-feira de Cinzas, tiram-se as máscaras.
        </p>
      </header>

      {season === "carnaval" && (
        <section className="border-2 border-ink bg-white p-4 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-scoop">Só tu sabes isto</p>
          <p className="mt-1 font-display text-3xl font-black">Hoje andas disfarçado de {myMask ?? "ninguém"} 🎭</p>
          <p className="mt-1 text-sm text-muted">Tudo o que escreveres hoje aparece com esse nome. Usa o disfarce com sabedoria.</p>
        </section>
      )}

      {over ? (
        <section>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black text-scoop">CAEM AS MÁSCARAS: quem era quem</h2>
          {days.map((d) => {
            const rows = reveal.filter((r) => r.day === d);
            if (rows.length === 0) return null;
            return (
              <div key={d} className="mt-3">
                <h3 className="font-display text-lg font-black first-letter:uppercase">{dayLabel.format(new Date(`${d}T12:00:00Z`))}</h3>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {rows.map((r) => (
                    <li key={r.person}><strong>{r.person}</strong> andou disfarçado de {r.disguise}</li>
                  ))}
                </ul>
              </div>
            );
          })}
          {reveal.length === 0 && <p className="mt-2 text-muted">Ninguém se disfarçou no último Carnaval.</p>}
        </section>
      ) : (
        <p className="text-muted">A revelação dos disfarces é na Quarta-feira de Cinzas.</p>
      )}
    </div>
  );
}
