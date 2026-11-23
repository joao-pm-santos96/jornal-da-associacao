import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getNow, lisbon } from "@/lib/seasons";
import { getRetrospective } from "@/lib/festas/anonovo";

function minutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-2 border-ink bg-white p-3 text-center">
      <p className="font-display text-4xl font-black">{value}</p>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
    </div>
  );
}

function Award({ title, who, detail }: { title: string; who?: string; detail?: string }) {
  return (
    <li className="border-b border-rule py-2">
      <span className="text-xs font-black uppercase tracking-widest text-scoop">{title}</span>
      <p className="font-display text-xl font-black">{who ?? "Ninguém, que vergonha"}</p>
      {detail && <p className="text-sm text-muted">{detail}</p>}
    </li>
  );
}

export default async function RetrospectivePage({ params }: { params: Promise<{ ano: string }> }) {
  await requireUser();
  const { ano } = await params;
  const year = Number(ano);
  const current = lisbon(await getNow()).year;
  if (!/^\d{4}$/.test(ano) || year < 2026 || year > current) notFound();
  const r = await getRetrospective(year);

  return (
    <div className="space-y-8">
      <header className="text-center">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Edição especial</p>
        <h1 className="font-display text-5xl font-black sm:text-6xl">O ANO EM REVISTA</h1>
        <p className="font-display text-3xl font-black">{year}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Posts" value={r.posts} />
        <Stat label="Comentários" value={r.comments} />
        <Stat label="Reações" value={r.reactions} />
        <Stat label="☕ em multas" value={r.fines} />
      </section>

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Os destaques</h2>
        <ul>
          <Award
            title="Furo do Ano"
            who={r.topPost?.title}
            detail={r.topPost ? `de ${r.topPost.name} · ${r.topPost.value} comentários` : undefined}
          />
          <Award title="Pena de Ouro" who={r.topWriter?.name} detail={r.topWriter ? `${r.topWriter.value} posts` : undefined} />
          <Award title="Comentador do Ano" who={r.topCommenter?.name} detail={r.topCommenter ? `${r.topCommenter.value} comentários` : undefined} />
          <Award title="Quem mais fez rir" who={r.funniest?.name} detail={r.funniest ? `${r.funniest.value} 😂 recebidos` : undefined} />
          <Award title="Quem mais se riu" who={r.laugher?.name} detail={r.laugher ? `${r.laugher.value} 😂 dados` : undefined} />
          <Award title="Leitor Relâmpago" who={r.fastestReader?.name} detail={r.fastestReader ? `lia tudo em média em ${minutes(r.fastestReader.value)}` : undefined} />
          <Award
            title="Escala de escrita"
            who={r.rotaTotal ? `${r.rotaDone} de ${r.rotaTotal} semanas cumpridas` : "Ainda sem semanas fechadas"}
          />
        </ul>
      </section>

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">👑 Os decretos do ano</h2>
        {r.decrees.length === 0 ? (
          <p className="mt-2 text-muted">Nem um decreto. Um ano de anarquia.</p>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 pl-6">
            {r.decrees.map((d) => <li key={d}>{d}</li>)}
          </ol>
        )}
      </section>

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">🎲 O casino</h2>
        {r.casino.length === 0 ? (
          <p className="mt-2 text-muted">Ninguém apostou um grão. Um ano de gente ajuizada.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {r.casino.map((c) => (
              <li key={c.name} className="flex justify-between py-1.5">
                <span>{c.name}</span>
                <span className={`font-bold ${c.value < 0 ? "text-scoop" : ""}`}>{c.value > 0 ? "+" : c.value < 0 ? "−" : ""}{Math.abs(c.value)} ☕</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-sm">
        <Link href="/resolucoes" className="font-semibold underline hover:text-scoop">E agora, as resoluções para o ano novo →</Link>
      </p>
    </div>
  );
}
