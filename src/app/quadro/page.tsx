import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAwards, type Award } from "@/lib/awards";

const TONES = {
  honor: { box: "bg-white", winner: "" },
  shame: { box: "bg-[#fff1f0]", winner: "text-scoop" },
  coward: { box: "bg-[#fff8db]", winner: "text-[#9a6b00]" },
} as const;

function AwardCard({ award, tone }: { award: Award; tone: keyof typeof TONES }) {
  const body = (
    <>
      <p className="text-3xl" aria-hidden="true">{award.emoji}</p>
      <h3 className="mt-1 font-display text-xl font-black leading-tight">{award.title}</h3>
      <p className="text-xs uppercase tracking-wider text-muted">{award.description}</p>
      <p className={`mt-3 font-display text-2xl font-black ${TONES[tone].winner}`}>
        {award.winner ?? "Ninguém… ainda"}
      </p>
      {award.stat && <p className="text-sm text-muted">{award.stat}</p>}
    </>
  );
  const box = `block h-full border-2 border-ink p-4 ${TONES[tone].box}`;
  return award.href ? (
    <Link href={award.href} className={`${box} hover:bg-flash`}>{body}</Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

export default async function BoardPage() {
  await requireUser();
  const { honor, shame, coward } = await getAwards();
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">Quadro de Honra</h1>
        <p className="text-muted">Prémios atribuídos automaticamente, sem júri, sem recurso e sem misericórdia.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {honor.map((a) => <AwardCard key={a.title} award={a} tone="honor" />)}
      </section>
      <header className="border-t-4 border-ink pt-6">
        <h2 className="font-display text-4xl font-black text-scoop sm:text-5xl">Mural da Vergonha</h2>
        <p className="text-muted">A redação lamenta informar.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shame.map((a) => <AwardCard key={a.title} award={a} tone="shame" />)}
      </section>
      <header className="border-t-4 border-ink pt-6">
        <h2 className="font-display text-4xl font-black text-[#9a6b00] sm:text-5xl">Quadro da Cobardia</h2>
        <p className="text-muted">Quem foge a um duelo fica aqui. Para sempre, ou até alguém fugir mais.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coward.map((a) => <AwardCard key={a.title} award={a} tone="coward" />)}
      </section>
      <p className="text-xs text-muted">
        As leituras só contam a partir do momento em que o «visto por» foi ligado.
      </p>
    </div>
  );
}
