import Link from "next/link";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { formatSchedule } from "@/lib/dates";
import { shortDate } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { getNow, seededRandom } from "@/lib/seasons";
import { JOKE_MAX, closeDueWeeks, comedyClock, jokesFor, myVote, openVoting, pastResults } from "@/lib/comedy";
import { notifyComedy } from "@/lib/push";
import { JokeForm, VoteButton } from "./ComedyForms";

export default async function ComedyClubPage() {
  const user = await requireUser();
  const [R, now] = await Promise.all([getRules(), getNow()]);
  const closed = await closeDueWeeks(now, R);
  const opened = await openVoting(now, R);
  if (closed.length > 0 || opened) after(() => notifyComedy(opened, closed, R));
  const clock = comedyClock(now, R);
  const [jokes, vote, results] = await Promise.all([jokesFor(clock.week), myVote(clock.week, user.id), pastResults()]);
  const mine = jokes.find((j) => j.author_id === user.id) ?? null;
  const random = seededRandom(`comedy-${clock.week}`);
  const ballot = jokes.map((j) => ({ j, k: random() })).sort((a, b) => a.k - b.k).map(({ j }) => j);
  const latest = results[0] ?? null;
  const reigning = latest && latest.winner && now.getTime() - new Date(latest.closed_at).getTime() < 7 * 86_400_000 ? latest : null;
  const lastWeekJokes = latest ? await jokesFor(latest.week_start) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="border-b-4 border-double border-ink pb-3 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Todas as sextas, ao vivo (mais ou menos)</p>
        <h1 className="font-display text-5xl font-black">🎤 Comedy Club</h1>
        <p className="mt-1 text-sm text-muted">
          Uma piada por sócio por semana, de borla. À sexta, das {R.comedyVoteOpensHour}h às {R.comedyVoteClosesHour}h, vota-se na melhor. Quem ganhar leva{" "}
          <strong>{R.comedyPrize} ☕</strong> do Cofre e o título de <strong>palhaço da semana 🤡</strong>.{" "}
          <Link href="/regras#comedy" className="underline hover:text-scoop">Regras</Link>
        </p>
      </header>

      {reigning && (
        <section className="border-4 border-ink bg-flash p-4 text-center">
          <p className="text-xs font-black uppercase tracking-widest">Palhaço da semana</p>
          <p className="font-display text-3xl font-black">{reigning.winner}</p>
          {reigning.body && <blockquote className="mx-auto mt-2 max-w-md whitespace-pre-wrap italic">«{reigning.body}»</blockquote>}
          <p className="mt-1 text-sm">
            {reigning.votes} {reigning.votes === 1 ? "voto" : "votos"} · {reigning.prize > 0 ? `+${reigning.prize} ☕` : "o Cofre não tinha para o prémio"}
          </p>
        </section>
      )}

      {clock.phase === "submit" ? (
        <section className="space-y-3 border-2 border-ink bg-white p-4">
          <h2 className="font-display text-2xl font-black">A tua piada da semana de {shortDate(clock.week)}</h2>
          <p className="text-sm text-muted">
            As piadas ficam em segredo até abrir a votação, {formatSchedule(clock.opensAt)}. Até lá podes mudá-la ou retirá-la.{" "}
            {jokes.length === 0 ? "Ainda ninguém se atreveu." : `Já ${jokes.length === 1 ? "há 1 piada" : `há ${jokes.length} piadas`} a concurso.`}
          </p>
          <JokeForm current={mine?.body ?? null} max={JOKE_MAX} />
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">😂 Votação aberta até {formatSchedule(clock.closesAt)}</h2>
          <p className="text-sm text-muted">
            As piadas estão sem nome. Vota na que te fez rir mais (na tua não podes). Os votos e os autores revelam-se quando fechar.
          </p>
          {ballot.length === 0 && <p className="text-sm italic">Esta semana ninguém contou nada. Silêncio constrangedor.</p>}
          <ul className="space-y-3">
            {ballot.map((j, i) => (
              <li key={j.id} className={`border-2 border-ink p-4 ${vote === j.id ? "bg-flash" : "bg-white"}`}>
                <p className="text-xs font-black uppercase tracking-widest text-scoop">Piada n.º {i + 1}</p>
                <p className="mt-1 whitespace-pre-wrap text-lg">{j.body}</p>
                <div className="mt-2">
                  {j.author_id === user.id ? (
                    <span className="text-sm font-bold text-muted">É a tua. Boa sorte.</span>
                  ) : (
                    <VoteButton jokeId={j.id} chosen={vote === j.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latest && lastWeekJokes.length > 0 && (
        <section>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">A última sessão (semana de {shortDate(latest.week_start)})</h2>
          <ul className="divide-y divide-rule">
            {[...lastWeekJokes].sort((a, b) => b.votes - a.votes).map((j) => (
              <li key={j.id} className="py-3">
                <p className="whitespace-pre-wrap">{j.body}</p>
                <p className="mt-1 text-sm">
                  <strong>{j.author}</strong> · {j.votes} {j.votes === 1 ? "voto" : "votos"}
                  {latest.winner_id === j.author_id && latest.winner && " · 🤡 vencedora"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.length > 0 && (
        <section>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Galeria dos palhaços</h2>
          <ul className="divide-y divide-rule">
            {results.map((r) => (
              <li key={r.week_start} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="text-xs font-black uppercase tracking-widest text-muted">Semana de {shortDate(r.week_start)} · </span>
                  <strong>{r.winner ?? "ninguém votou"}</strong>
                </span>
                <span>
                  {r.entries} {r.entries === 1 ? "piada" : "piadas"}
                  {r.winner && ` · ${r.votes} ${r.votes === 1 ? "voto" : "votos"}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
