import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getEconomy } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { formatDateTime } from "@/lib/dates";
import { cancelCommission, decideCommission } from "@/app/economia-actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ClaimForm, NewCommissionForm } from "./CommissionForms";

type Commission = {
  id: number;
  requester_id: number;
  requester: string;
  theme: string;
  reward: number;
  deadline: Date;
  status: "open" | "claimed" | "paid" | "refunded" | "cancelled";
  post_id: number | null;
  post_title: string | null;
  author: string | null;
  created_at: Date;
};

const STATUS: Record<Commission["status"], string> = {
  open: "Aberta",
  claimed: "Entregue, à espera de resposta",
  paid: "Paga",
  refunded: "Devolvida (ninguém pegou)",
  cancelled: "Cancelada",
};

export default async function CommissionsPage() {
  const R = await getRules();
  const user = await requireUser();
  const [economy, commissionRows, postRows] = await Promise.all([
    getEconomy(),
    sql`
      SELECT c.id, c.requester_id, member_label(c.requester_id) AS requester, c.theme, c.reward, c.deadline, c.status,
        c.post_id, p.title AS post_title, CASE WHEN c.author_id IS NULL THEN NULL ELSE member_label(c.author_id) END AS author,
        c.created_at
      FROM commissions c LEFT JOIN posts p ON p.id = c.post_id
      ORDER BY (c.status IN ('open', 'claimed')) DESC, c.created_at DESC
      LIMIT 40
    `,
    sql`
      SELECT id, title, publish_at FROM visible_posts WHERE author_id = ${user.id} ORDER BY publish_at DESC LIMIT 20
    `,
  ]);
  const commissions = commissionRows as Commission[];
  const myPosts = postRows as { id: number; title: string; publish_at: Date }[];
  const balance = economy.balances.find((b) => b.user_id === user.id)?.balance ?? 0;
  const active = commissions.filter((c) => c.status === "open" || c.status === "claimed");
  const closed = commissions.filter((c) => c.status !== "open" && c.status !== "claimed");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <p className="text-sm">
        <Link href="/cofre" className="underline hover:text-scoop">← Cofre</Link>
      </p>
      <header className="border-b-4 border-ink pb-3">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Redação por encomenda</p>
        <h1 className="font-display text-4xl font-black">Encomendas de posts</h1>
        <p className="text-sm text-muted">
          Oferece grãos a quem escrever sobre um tema. Os grãos ficam retidos no Cofre até ao fim. Se ninguém entregar até ao prazo,
          voltam para ti; se houver uma entrega sem resposta até ao prazo, paga-se sozinha.
        </p>
      </header>

      {economy.open && (
        <section className="border-2 border-ink bg-white p-4">
          <h2 className="mb-3 font-display text-2xl font-black">Nova encomenda</h2>
          <NewCommissionForm balance={balance} maxDays={R.commissionMaxDays} />
        </section>
      )}

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Em aberto</h2>
        {active.length === 0 ? (
          <p className="mt-2 text-muted">Ninguém encomendou nada. A redação escreve o que lhe apetece.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {active.map((c) => {
              const mineRequest = c.requester_id === user.id;
              const eligible = myPosts.filter((p) => new Date(p.publish_at) >= new Date(c.created_at));
              return (
                <li key={c.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold">«{c.theme}»</p>
                    <p className="font-display text-2xl font-black">{c.reward} ☕</p>
                  </div>
                  <p className="text-xs text-muted">
                    Encomenda n.º {c.id} de {c.requester} · prazo {formatDateTime(c.deadline)} · {STATUS[c.status]}
                  </p>
                  {c.status === "claimed" && c.post_id && (
                    <p className="text-sm">
                      Entregue por <strong>{c.author}</strong>:{" "}
                      <Link href={`/post/${c.post_id}`} className="underline hover:text-scoop">{c.post_title}</Link>
                    </p>
                  )}
                  {mineRequest && c.status === "open" && (
                    <form action={cancelCommission.bind(null, c.id)}>
                      <ConfirmButton message="Cancelar a encomenda e recuperar os grãos?" className="text-xs font-semibold text-scoop underline">
                        Cancelar e recuperar os grãos
                      </ConfirmButton>
                    </form>
                  )}
                  {mineRequest && c.status === "claimed" && (
                    <div className="flex gap-2">
                      <form action={decideCommission.bind(null, c.id, true)}>
                        <button className="bg-ink px-3 py-1 text-xs font-bold uppercase text-white">Aceitar e pagar</button>
                      </form>
                      <form action={decideCommission.bind(null, c.id, false)}>
                        <button className="border-2 border-ink px-3 py-1 text-xs font-bold uppercase">Recusar</button>
                      </form>
                    </div>
                  )}
                  {!mineRequest && c.status === "open" && economy.open && <ClaimForm commissionId={c.id} posts={eligible} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Arquivo</h2>
          <ul className="divide-y divide-rule text-sm">
            {closed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  «{c.theme}» · {c.requester}
                  {c.status === "paid" && c.post_id && (
                    <>
                      {" "}→ <Link href={`/post/${c.post_id}`} className="underline hover:text-scoop">{c.author}</Link>
                    </>
                  )}
                  <span className="block text-xs text-muted">{STATUS[c.status]}</span>
                </span>
                <span className="font-bold">{c.reward} ☕</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
