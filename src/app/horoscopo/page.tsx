import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentEdition, editionLabel } from "@/lib/dates";
import { horoscopeFor } from "@/lib/horoscope";

export default async function HoroscopePage() {
  const user = await requireUser();
  const people = (await sql`SELECT id, name FROM users ORDER BY id`) as { id: number; name: string }[];
  const month = currentEdition();
  const ordered = [...people.filter((p) => p.id === user.id), ...people.filter((p) => p.id !== user.id)];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">Horóscopo da Associação</h1>
        <p className="text-muted">
          {editionLabel(month)} · previsões rigorosamente científicas, calculadas por astrólogos com fome.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {ordered.map((person) => {
          const h = horoscopeFor(person, people.filter((p) => p.id !== person.id).map((p) => p.name), month);
          return (
            <article key={person.id}
              className={`border-2 border-ink p-4 ${person.id === user.id ? "bg-flash" : "bg-white"}`}>
              <p className="text-xs font-black uppercase tracking-widest text-scoop">
                {person.id === user.id ? "O teu signo" : "Signo"}: {h.sign.emoji} {h.sign.name}
              </p>
              <h2 className="font-display text-2xl font-black">{person.name}</h2>
              <dl className="mt-2 space-y-2 text-sm">
                <div><dt className="inline font-bold">❤️ Amor: </dt><dd className="inline">{h.love}</dd></div>
                <div><dt className="inline font-bold">📰 Redação: </dt><dd className="inline">{h.newsroom}</dd></div>
                <div><dt className="inline font-bold">🔮 Conselho: </dt><dd className="inline">{h.advice}</dd></div>
                <div>
                  <dt className="inline font-bold">🍀 Sorte: </dt>
                  <dd className="inline">número {h.luckyNumber}, cor {h.color}, objeto: {h.luckyObject}</dd>
                </div>
                <div><dt className="inline font-bold">🤝 Compatível com: </dt><dd className="inline">{h.match}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}
