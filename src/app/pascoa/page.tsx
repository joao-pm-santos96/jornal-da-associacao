import { requireUser } from "@/lib/auth";
import { getNow, getSeason, lisbon } from "@/lib/seasons";
import { GRAOS } from "@/lib/economy";
import { EGG_COUNT, eggLeaderboard, foundEggs, godparents } from "@/lib/festas/pascoa";

export default async function EasterPage() {
  const user = await requireUser();
  const [now, season] = await Promise.all([getNow(), getSeason()]);
  const year = lisbon(now).year;
  const [board, mine, padrinhos] = await Promise.all([eggLeaderboard(year), foundEggs(year, user.id), godparents(year)]);
  const padrinho = padrinhos.get(user.id);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">🐰 Páscoa na Associação</h1>
        <p className="text-muted">
          {season === "pascoa"
            ? `Há ${EGG_COUNT} ovos 🥚 escondidos pelo jornal. Cada um vale +${GRAOS.egg} ☕. Procura bem: estão em páginas e sítios diferentes.`
            : "A caça aos ovos só acontece entre a Sexta-feira Santa e a Segunda-feira de Páscoa."}
        </p>
      </header>

      <section className="border-2 border-ink bg-white p-4 text-center">
        <p className="font-display text-5xl font-black">{mine.length} / {EGG_COUNT} 🥚</p>
        <p className="text-sm text-muted">ovos encontrados por ti em {year}</p>
      </section>

      {padrinho && (
        <section className="border-2 border-ink bg-flash p-4">
          <h2 className="font-display text-2xl font-black">🥖 O teu folar</h2>
          <p className="mt-1">
            Este ano o teu padrinho é <strong>{padrinho.name}</strong>, que te entrega a tua parte do folar no Domingo de Páscoa: o Cofre reparte {GRAOS.folarPct}% do que tem por todos.
            <span className="block text-sm text-muted">(Quem paga é o Cofre. O padrinho só dá a cara.)</span>
          </p>
        </section>
      )}

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">🏆 Coelho do Ano {year}</h2>
        {board.length === 0 ? (
          <p className="mt-2 text-muted">Ainda ninguém encontrou um ovo.</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {board.map((b, i) => (
              <li key={b.name} className="flex justify-between border-b border-rule py-1">
                <span>{i === 0 ? "🐰 " : `${i + 1}. `}<strong>{b.name}</strong></span>
                <span>{b.eggs} 🥚</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
