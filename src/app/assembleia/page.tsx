import Link from "next/link";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { formatSchedule } from "@/lib/dates";
import { DURATIONS, closeDueAssemblies, listAssemblies, outcomeLabel, pendingExecution, type AssemblySummary } from "@/lib/assembly";
import { notifyAssemblyResults } from "@/lib/push";
import { ConveneForm } from "./AssemblyForms";

function Tags({ a }: { a: AssemblySummary }) {
  return (
    <span className="text-xs font-bold uppercase tracking-wider text-muted">
      {a.constitutional ? "constitucional · " : a.binding ? "vinculativa · " : "consultiva · "}
      {a.secret ? "voto secreto" : "voto nominal"}
    </span>
  );
}

export default async function AssemblyPage() {
  const user = await requireUser();
  const closed = await closeDueAssemblies();
  if (closed.length > 0) after(() => notifyAssemblyResults(closed));
  const all = await listAssemblies(user.id);
  const open = all.filter((a) => a.status === "open");
  const pending = all.filter(pendingExecution);
  const minutes = all.filter((a) => a.status !== "open");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="border-b-4 border-double border-ink pb-3 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Órgão soberano</p>
        <h1 className="font-display text-4xl font-black sm:text-5xl">🗳️ Assembleia da Associação</h1>
        <p className="mt-1 text-sm text-muted">
          Qualquer sócio convoca, todos votam e decide a maioria de quem votou. Em caso de empate, o Presidente tem voto de qualidade.{" "}
          <Link href="/regras#assembleia" className="underline hover:text-scoop">Regimento</Link>
        </p>
      </header>

      <details className="border-2 border-ink bg-white">
        <summary className="cursor-pointer list-none p-4 text-center font-display text-2xl font-black">✋ Convocar uma votação</summary>
        <div className="border-t-2 border-dashed border-ink p-4">
          <ConveneForm durations={DURATIONS} />
        </div>
      </details>

      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Em votação</h2>
        {open.length === 0 && <p className="text-sm text-muted">Não há nada a votar. A Assembleia está de férias.</p>}
        <ul className="space-y-3">
          {open.map((a) => (
            <li key={a.id}>
              <Link href={`/assembleia/${a.id}`} className={`block border-2 border-ink p-4 hover:bg-flash ${a.voted ? "bg-white" : "bg-flash/40"}`}>
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <Tags a={a} />
                  <span className="text-xs font-bold">fecha {formatSchedule(a.closes_at)}</span>
                </span>
                <span className="mt-1 block font-display text-2xl font-black leading-tight">{a.title}</span>
                <span className="mt-1 block text-sm">
                  {a.voted ? "✅ Já votaste" : <strong className="text-scoop">✋ Ainda não votaste</strong>} · {a.voters}{" "}
                  {a.voters === 1 ? "voto" : "votos"} · convocada por {a.author ?? "um ex-sócio"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {pending.length > 0 && (
        <section className="space-y-2 border-4 border-scoop bg-white p-4">
          <h2 className="font-display text-2xl font-black text-scoop">📌 Por cumprir</h2>
          <p className="text-sm text-muted">Decisões vinculativas aprovadas que o governo ainda não cumpriu.</p>
          <ul className="divide-y divide-rule">
            {pending.map((a) => (
              <li key={a.id} className="py-2">
                <Link href={`/assembleia/${a.id}`} className="font-bold underline hover:text-scoop">{a.title}</Link>
                <span className="block text-sm">{outcomeLabel(a)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {minutes.length > 0 && (
        <section>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Atas</h2>
          <ul className="divide-y divide-rule">
            {minutes.map((a) => (
              <li key={a.id}>
                <Link href={`/assembleia/${a.id}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2 hover:text-scoop">
                  <span>
                    <span className="text-xs font-black uppercase tracking-widest text-muted">Ata n.º {a.id} · </span>
                    <span className="font-bold">{a.title}</span>
                  </span>
                  <span className={`text-sm ${a.outcome === "aprovada" || a.outcome === "escolhida" ? "font-bold" : ""}`}>
                    {outcomeLabel(a)}
                    {a.binding && a.done_at && " · ✅ cumprida"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
