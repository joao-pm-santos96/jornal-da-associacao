import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { GIFT_REASON_MAX, GRAOS, getEconomy, listMovements, payrollBudget, splitByPoints, weekOf, weekPoints, lisbonMidnight } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { getOffices } from "@/lib/offices";
import { formatDateTime } from "@/lib/dates";
import { getNow } from "@/lib/seasons";
import { decideSubsidy } from "@/app/governo-actions";
import { grains } from "@/lib/grains";
import { MovementForm } from "./MovementForm";
import { RedistributeForm } from "./RedistributeForm";
import { AmnestyForm, GiftForm, NicknameForm, PardonButton } from "./EconomyForms";
import { RepresentationForm } from "./RepresentationForms";
import { EXCUSE_MAX, hasSlushHistory, readLetters, slushState, type SlushState } from "@/lib/slush";
import { ConfidentialLetter } from "./ConfidentialLetter";
import { LetterBody } from "./LetterBody";

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function Representation({ slush, max }: { slush: SlushState; max: number }) {
  return (
    <div className="space-y-2 border-t-2 border-dashed border-ink pt-3">
      <h3 className="font-bold">💼 Despesas de representação</h3>
      <p className="text-sm text-muted">
        Uma por semana, até {GRAOS.slushPct}% do disponível ({max} ☕). Aparece no livro do Cofre com a justificação; o destino é confidencial.
      </p>
      <RepresentationForm max={max} excuseMax={EXCUSE_MAX} done={slush.desviou} />
      <p className="text-sm">
        <Link href="/cofre/saco-azul" className="underline hover:text-scoop">Ver o teu saco azul ({slush.balance} ☕) →</Link>
      </p>
    </div>
  );
}

type SubsidyRequest = { id: number; name: string; amount: number; reason: string; created_at: Date };

export default async function TreasuryPage() {
  const R = await getRules();
  const user = await requireUser();
  const now = await getNow();
  const week = weekOf(now);
  const [economy, movements, offices] = await Promise.all([getEconomy(), listMovements(), getOffices()]);
  const isTreasurer = offices.tesoureiro?.user_id === user.id;
  const isPresident = offices.presidente?.user_id === user.id;

  const weekStart = lisbonMidnight(week);
  const points =
    economy.open && economy.start ? await weekPoints(week, economy.start > weekStart ? economy.start : weekStart, now) : [];
  const budget = payrollBudget(economy.available, R.payrollPct);
  const estimate = splitByPoints(budget, new Map(points.map((p) => [p.user_id, p.points])), () => 0.5);
  const mine = points.find((p) => p.user_id === user.id);
  const myBalance = economy.balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const requests = isPresident
    ? ((await sql`
        SELECT r.id, member_label(r.user_id) AS name, r.amount, r.reason, r.created_at
        FROM subsidy_requests r WHERE r.status = 'pending' ORDER BY r.created_at
      `) as SubsidyRequest[])
    : [];
  const members = economy.balances.map((b) => ({ id: b.user_id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
  const inOffice = isTreasurer || isPresident;
  const slush = inOffice || (await hasSlushHistory(user.id)) ? await slushState(user.id, now) : null;
  const repMax = Math.floor((Math.max(economy.available, 0) * GRAOS.slushPct) / 100);
  const letters = inOffice ? await readLetters(user.id) : new Set<string>();
  const debtors = economy.balances.filter((b) => b.balance < 0).map((b) => ({ id: b.user_id, name: b.name, balance: b.balance }));

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-black sm:text-5xl">Cofre da Associação</h1>
        <p className="text-muted">
          Contas certas, grãos contados. Tesoureiro: <strong>{offices.tesoureiro?.name ?? "vago"}</strong>.{" "}
          <Link href="/regras#cafe" className="underline hover:text-scoop">Como funciona?</Link>
        </p>
      </header>

      {!economy.open ? (
        <section className="border-2 border-ink bg-flash p-6 text-center">
          <p className="font-display text-3xl font-black">🚧 Cofre fechado para obras</p>
          <p className="mt-2 text-sm">A economia nova abre em breve. Até lá não se gastam nem se ganham grãos.</p>
        </section>
      ) : (
        <>
          <section className="border-2 border-ink bg-flash p-6 text-center">
            <p className="text-xs font-black uppercase tracking-widest">Disponível no Cofre</p>
            <p className="font-display text-6xl font-black">{economy.available} ☕</p>
            <p className="mt-1 text-sm">
              {economy.escrow > 0 && <>+{economy.escrow} ☕ em jogo (apostas, duelos e encomendas) · </>}
              {economy.debts > 0 ? <>{economy.debts} ☕ em dívidas a receber · </> : null}
              {economy.supply} ☕ em circulação no total
            </p>
            <p className="mt-2 text-sm">
              Na segunda-feira, o ordenado distribui <strong>{R.payrollPct}%</strong> do disponível: cerca de{" "}
              <strong>{budget} ☕</strong> se nada mudar.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link href="/cofre/livro" className="border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase tracking-wider hover:bg-ink hover:text-white">
                📒 Livro do Cofre
              </Link>
              <Link href="/cofre/encomendas" className="border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase tracking-wider hover:bg-ink hover:text-white">
                ✍️ Encomendas de posts
              </Link>
              <Link href="/cofre/tabela" className="border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase tracking-wider hover:bg-ink hover:text-white">
                📋 Preços e taxas
              </Link>
            </div>
          </section>

          {mine && (
            <section className="border-2 border-ink bg-white p-4">
              <h2 className="font-display text-2xl font-black">A tua semana</h2>
              <p className="mt-1">
                <strong>{mine.points} pontos</strong> até agora
                {mine.rota === "pending" && " (estás na escala: publica até domingo)"}
                {mine.rota === "pardoned" && " (indultado da escala)"}. Ordenado estimado na segunda-feira:{" "}
                <strong>{estimate.get(user.id) ?? 0} ☕</strong>, menos a cota de {R.weeklyFee} ☕.
              </p>
              <p className="mt-1 text-xs text-muted">
                Post {R.post} · comentário {R.comment} (até {R.commentCap} por semana) · 😂 recebido {R.laugh} (um por sócio por dia, até {R.laughCap}) · escala cumprida {R.rotaDone}.
                A estimativa muda com o que os outros fizerem até domingo.
              </p>
            </section>
          )}

          <section>
            <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Carteiras</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-2 pr-2">Sócio</th>
                    <th className="py-2 pr-2 text-right">Pontos da semana</th>
                    <th className="py-2 pr-2 text-right">Ordenado estimado</th>
                    <th className="py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {economy.balances.map((b) => {
                    const p = points.find((x) => x.user_id === b.user_id);
                    return (
                      <tr key={b.user_id} className={b.user_id === user.id ? "bg-white font-semibold" : ""}>
                        <td className="py-2 pr-2">
                          <Link href={`/cofre/socio/${b.user_id}`} className="underline decoration-rule underline-offset-2 hover:text-scoop" title="Ver extrato">
                            {b.name}
                          </Link>
                          {b.frozen ? (
                            <span className="ml-2 bg-ink px-1.5 py-0.5 text-[10px] font-black uppercase text-white">🧊 Congelado</span>
                          ) : b.balance < 0 ? (
                            <span className="ml-2 bg-scoop px-1.5 py-0.5 text-[10px] font-black uppercase text-white">Em dívida</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2 text-right">{p?.points ?? 0}</td>
                        <td className="py-2 pr-2 text-right">{estimate.get(b.user_id) ?? 0} ☕</td>
                        <td className={`py-2 text-right font-display text-lg font-black ${b.balance < 0 ? "text-scoop" : ""}`}>
                          {b.balance} ☕
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              Toca num nome para veres o extrato. Quem está em dívida não aposta, não dá gorjetas nem grãos, nem compra na loja; o ordenado paga a dívida primeiro.
              A {grains(R.debtFloor)} ☕ a conta congela (só se reage com 🧂) e a dívida deixa de crescer.
            </p>
          </section>

          <section className="space-y-2 border-2 border-ink bg-white p-4">
            <h2 className="font-display text-2xl font-black">💸 Dar grãos</h2>
            <p className="text-sm text-muted">Passa grãos teus a outro sócio, sem IVA nem taxas. O motivo fica nos extratos dos dois.</p>
            <GiftForm members={members.filter((m) => m.id !== user.id)} balance={myBalance} reasonMax={GIFT_REASON_MAX} />
          </section>

          <section className="space-y-4 border-2 border-ink bg-white p-4">
            <h2 className="font-display text-2xl font-black">🛒 Loja do Cofre</h2>
            <p className="text-sm text-muted">Tens {myBalance} ☕. O que se compra aqui vai para o Cofre e volta a todos no ordenado.</p>
            <div>
              <h3 className="font-bold">📌 Destacar um post ({R.highlight} ☕, {R.highlightHours} h)</h3>
              <p className="text-sm text-muted">Usa o botão «Destacar» na página de qualquer post.</p>
            </div>
            <div>
              <h3 className="font-bold">🙏 Indulto da escala ({R.pardon} ☕)</h3>
              <p className="mb-2 text-sm text-muted">Só na tua semana da escala, antes de publicares e antes de domingo acabar. Evita a multa de {R.rotaMissedFine} ☕.</p>
              {mine?.rota === "pending" ? (
                <PardonButton price={R.pardon} />
              ) : mine?.rota === "pardoned" ? (
                <p className="text-sm font-semibold">Esta semana estás indultado: não há multa nem pontos da escala.</p>
              ) : (
                <p className="text-sm">Não estás na escala por cumprir esta semana.</p>
              )}
            </div>
            <div>
              <h3 className="font-bold">🏷️ Alcunha durante {R.nicknameDays} dias ({R.nickname} ☕)</h3>
              <p className="mb-2 text-sm text-muted">Aparece junto ao nome em todo o jornal. Podes dá-la a ti ou a outro sócio.</p>
              <NicknameForm members={members} price={R.nickname} days={R.nicknameDays} />
            </div>
          </section>

          {slush && !inOffice && (
            <p className="text-sm">
              <Link href="/cofre/saco-azul" className="underline decoration-dashed hover:text-scoop">💼 O teu saco azul ({slush.balance} ☕)</Link>
            </p>
          )}

          {isTreasurer && (
            <section className="max-w-lg border-2 border-ink bg-white p-4">
              <h2 className="mb-3 font-display text-2xl font-black">💰 Gabinete do Tesoureiro</h2>
              <div className="mb-4">
                <ConfidentialLetter office="tesoureiro" unread={!letters.has("tesoureiro")}>
                  <LetterBody office="tesoureiro" />
                </ConfidentialLetter>
              </div>
              <p className="mb-3 text-sm text-muted">
                Subsídios até ao disponível ({Math.max(economy.available, 0)} ☕). Um subsídio a ti próprio precisa do aval do Presidente.
              </p>
              <MovementForm members={members} />
              <div className="mt-4 space-y-2 border-t-2 border-dashed border-ink pt-3">
                <h3 className="font-bold">🤝 Distribuir pelos sócios</h3>
                <p className="text-sm text-muted">
                  Reparte uma parte do Cofre por igual pelos {economy.balances.length} sócios, tu incluído. Os grãos que não dividam certo ficam no Cofre. Sai um despacho público.
                </p>
                <RedistributeForm available={Math.max(economy.available, 0)} members={economy.balances.length} />
              </div>
              <p className="mt-4 border-t-2 border-dashed border-ink pt-3 text-sm">
                <Link href="/cofre/tabela" className="font-bold underline hover:text-scoop">⚙️ Mudar preços, taxas e percentagens →</Link>
                <span className="block text-xs text-muted">Tudo menos o total de grãos em circulação. Entra em vigor de imediato e sai num despacho.</span>
              </p>
              {slush && <Representation slush={slush} max={repMax} />}
            </section>
          )}

          {isPresident && (
            <section className="max-w-lg space-y-4 border-2 border-ink bg-white p-4">
              <h2 className="font-display text-2xl font-black">👑 Gabinete do Presidente</h2>
              <ConfidentialLetter office="presidente" unread={!letters.has("presidente")}>
                <LetterBody office="presidente" />
              </ConfidentialLetter>
              {requests.length > 0 && (
                <div>
                  <h3 className="font-bold">Pedidos de aval do Tesoureiro</h3>
                  <ul className="divide-y divide-rule">
                    {requests.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span>
                          <strong>{r.name}</strong> pede <strong>{r.amount} ☕</strong> · {r.reason}
                          <span className="block text-xs text-muted">{formatDateTime(r.created_at)}</span>
                        </span>
                        <span className="flex gap-2">
                          <form action={decideSubsidy.bind(null, r.id, true)}>
                            <button className="bg-ink px-3 py-1 text-xs font-bold uppercase text-white">Dar aval</button>
                          </form>
                          <form action={decideSubsidy.bind(null, r.id, false)}>
                            <button className="border-2 border-ink px-3 py-1 text-xs font-bold uppercase">Recusar</button>
                          </form>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="font-bold">🕊️ Amnistia</h3>
                {debtors.length === 0 ? (
                  <p className="text-sm text-muted">Ninguém deve nada ao Cofre.</p>
                ) : (
                  <AmnestyForm debtors={debtors} />
                )}
              </div>
              {slush && !isTreasurer && <Representation slush={slush} max={repMax} />}
            </section>
          )}
        </>
      )}

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Últimos movimentos</h2>
        {movements.length === 0 ? (
          <p className="mt-2 text-muted">Ainda nenhum movimento.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {movements.map((m) => (
              <li key={m.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{m.name}</strong> · {m.reason}
                  <span className="block text-xs text-muted">
                    {formatDateTime(m.created_at)} · {m.by ? `por ${m.by}` : "automático"}
                  </span>
                </span>
                <span className={`font-display text-lg font-black ${m.amount < 0 ? "text-scoop" : ""}`}>
                  {signed(m.amount)} ☕
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
