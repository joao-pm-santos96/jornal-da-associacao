import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatSchedule } from "@/lib/dates";
import { closeDueAssemblies, getAssembly, outcomeLabel, pendingExecution } from "@/lib/assembly";
import { getOffices } from "@/lib/offices";
import { notifyAssemblyResults } from "@/lib/push";
import { ConfirmButton } from "@/components/ConfirmButton";
import { AssemblyCommentForm, VoteForm } from "../AssemblyForms";
import { markDone, voidAssembly } from "../actions";

export default async function AssemblyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const closed = await closeDueAssemblies();
  if (closed.length > 0) after(() => notifyAssemblyResults(closed));
  const [a, offices] = await Promise.all([getAssembly(id, user.id), getOffices()]);
  if (!a) notFound();
  const open = a.status === "open";
  const total = a.options.reduce((s, o) => s + o.votes, 0);
  const government = user.is_admin || offices.presidente?.user_id === user.id || offices.tesoureiro?.user_id === user.id;
  const canVoid = open && (a.created_by === user.id || user.is_admin);
  const won = (optionId: number) => a.status === "closed" && (a.outcome === "escolhida" ? a.options.find((o) => o.label === a.winner)?.id === optionId : false);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <p className="text-sm">
        <Link href="/assembleia" className="underline hover:text-scoop">← Assembleia</Link>
      </p>
      <header className="border-b-4 border-double border-ink pb-3">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">
          {open ? `Votação n.º ${a.id}` : `Ata n.º ${a.id}`} · {a.constitutional ? "constitucional (2/3)" : a.binding ? "vinculativa" : "consultiva"} ·{" "}
          {a.secret ? "voto secreto" : "voto nominal"}
        </p>
        <h1 className="mt-1 font-display text-3xl font-black leading-tight sm:text-4xl">{a.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Convocada por {a.author ?? "um ex-sócio"} · {open ? `fecha ${formatSchedule(a.closes_at)}` : a.closed_at ? `fechou a ${formatDateTime(a.closed_at)}` : ""}
        </p>
        {a.body && <p className="mt-3 whitespace-pre-wrap">{a.body}</p>}
      </header>

      {!open && (
        <section className={`border-4 p-4 text-center ${a.outcome === "aprovada" || a.outcome === "escolhida" ? "border-ink bg-flash" : "border-scoop bg-white"}`}>
          <p className="text-xs font-black uppercase tracking-widest">Resultado</p>
          <p className="font-display text-3xl font-black">{outcomeLabel(a)}</p>
          {a.status === "closed" && <p className="text-sm">{total} {total === 1 ? "voto" : "votos"} de {a.members} sócios</p>}
          {a.binding && a.done_at && <p className="mt-1 text-sm font-bold">✅ Cumprida por {a.done_by}</p>}
          {pendingExecution(a) && (
            <div className="mt-2 space-y-2">
              <p className="text-sm font-bold text-scoop">📌 Decisão vinculativa por cumprir</p>
              {government && (
                <form action={markDone.bind(null, a.id)}>
                  <ConfirmButton message="Marcar esta decisão como cumprida?" className="bg-ink px-3 py-1.5 text-xs font-bold uppercase text-white">
                    Marcar como cumprida
                  </ConfirmButton>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">{open ? "O teu voto" : "Votos"}</h2>
        {open ? (
          <>
            <VoteForm id={a.id} options={a.options.map((o) => ({ id: o.id, label: o.label }))} mine={a.mine} />
            <p className="text-sm text-muted">
              Os totais só se conhecem quando a votação fechar. Já {a.votes.length === 1 ? "votou" : "votaram"} {a.votes.length} de {a.members}
              {a.votes.length > 0 && `: ${a.votes.map((v) => v.name).join(", ")}`}.
            </p>
          </>
        ) : (
          a.status === "closed" && (
            <ul className="space-y-2">
              {a.options.map((o) => {
                const pct = total > 0 ? Math.round((o.votes * 100) / total) : 0;
                const names = a.votes.filter((v) => v.option_id === o.id).map((v) => v.name);
                return (
                  <li key={o.id} className={`border-2 border-ink bg-white p-2 ${won(o.id) ? "outline outline-4 outline-flash" : ""}`}>
                    <div className="flex items-baseline justify-between gap-2 font-semibold">
                      <span>{o.label}{a.mine === o.id && <span className="ml-2 text-xs font-bold uppercase text-scoop">o teu voto</span>}</span>
                      <span>{o.votes} · {pct}%</span>
                    </div>
                    <div className="mt-1 h-2 bg-rule"><div className="h-2 bg-ink" style={{ width: `${pct}%` }} /></div>
                    {!a.secret && names.length > 0 && <p className="mt-1 text-xs text-muted">{names.join(", ")}</p>}
                  </li>
                );
              })}
            </ul>
          )
        )}
        {canVoid && (
          <form action={voidAssembly.bind(null, a.id)}>
            <ConfirmButton message="Anular esta votação? Fica nas atas como anulada." className="text-sm text-scoop underline">
              Anular a votação
            </ConfirmButton>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Debate</h2>
        {a.comments.length === 0 && <p className="text-sm text-muted">Ninguém pediu a palavra.</p>}
        <ul className="divide-y divide-rule">
          {a.comments.map((c) => (
            <li key={c.id} className="py-2">
              <p className="text-sm"><strong>{c.author}</strong> <span className="text-xs text-muted">· {formatDateTime(c.created_at)}</span></p>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
        <AssemblyCommentForm id={a.id} />
      </section>
    </div>
  );
}
