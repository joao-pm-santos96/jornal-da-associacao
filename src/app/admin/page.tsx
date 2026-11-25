import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { CreateUserForm } from "./CreateUserForm";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { RotaForm } from "./RotaForm";
import { OfficeForm } from "./OfficeForm";
import { TimeMachineForm } from "./TimeMachineForm";
import { ResetRulesForm } from "./ResetRulesForm";
import { RULE_KEYS, defaultRules, getRules } from "@/lib/rules";
import { getFakeNow } from "@/lib/seasons";
import { getOffices } from "@/lib/offices";
import { removeRotaSlot, setModuleOpen } from "./actions";
import { MODULES, MODULE_KEYS, getClosedModules } from "@/lib/modules";
import { getRota } from "@/lib/rota";
import { ConfirmButton } from "@/components/ConfirmButton";

type Row = { id: number; username: string; name: string; is_admin: boolean; created_at: Date };

export default async function AdminPage() {
  const user = await requireUser();
  if (!user.is_admin) notFound();
  const [userRows, rota, mondayRows, offices, fakeNow, rules, closedModules] = await Promise.all([
    sql`SELECT id, username, name, is_admin, created_at FROM users ORDER BY created_at`,
    getRota(),
    sql`SELECT to_char(date_trunc('week', now() AT TIME ZONE 'Europe/Lisbon') + interval '7 days', 'YYYY-MM-DD') AS next_monday`,
    getOffices(),
    getFakeNow(),
    getRules(),
    getClosedModules(),
  ]);
  const fakeLocal = fakeNow
    ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }).format(fakeNow).replace(" ", "T")
    : "";
  const users = userRows as Row[];
  const defaults = defaultRules();
  const changedRules = RULE_KEYS.filter((k) => rules[k] !== defaults[k]).length;
  const [{ next_monday }] = mondayRows as { next_monday: string }[];

  return (
    <div className="space-y-10">
      <section className="max-w-sm">
        <h1 className="mb-4 font-display text-3xl font-black">Nova conta</h1>
        <CreateUserForm />
      </section>
      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">⏰ Máquina do tempo</h2>
        <TimeMachineForm current={fakeLocal} />
      </section>
      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Cargos</h2>
        <OfficeForm
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          current={{
            presidente: offices.presidente?.user_id,
            tesoureiro: offices.tesoureiro?.user_id,
            apostas: offices.apostas?.user_id,
          }}
        />
      </section>
      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">🛠️ Regras da economia</h2>
        <ResetRulesForm changed={changedRules} />
      </section>
      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">🔒 Módulos</h2>
        <p className="text-sm text-muted">Fechar um módulo impede coisas novas (apostas, jogadas, encomendas, festas); o que já está em curso termina normalmente. Cada mudança sai como intervenção em /decretos.</p>
        <ul className="divide-y divide-rule">
          {MODULE_KEYS.map((m) => {
            const open = !closedModules.has(m);
            return (
              <li key={m} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{MODULES[m].label}</strong> · {open ? "aberto" : <span className="font-bold text-scoop">fechado</span>}
                </span>
                <form action={setModuleOpen.bind(null, m, !open)}>
                  <ConfirmButton
                    message={open ? `Fechar: ${MODULES[m].label}? Sai uma intervenção pública.` : `Reabrir: ${MODULES[m].label}?`}
                    className={open ? "bg-scoop px-3 py-1 text-xs font-bold uppercase text-white" : "bg-ink px-3 py-1 text-xs font-bold uppercase text-white"}
                  >
                    {open ? "Fechar" : "Reabrir"}
                  </ConfirmButton>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Escala de escrita</h2>
        <RotaForm users={users.map((u) => ({ id: u.id, name: u.name }))} nextMonday={next_monday} />
        {rota.length > 0 && (
          <ul className="divide-y divide-rule">
            {rota.map((s) => (
              <li key={s.week_start} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="text-muted">{s.week_start}</span> · <strong>{s.name}</strong>
                </span>
                <form action={removeRotaSlot.bind(null, s.week_start)}>
                  <ConfirmButton message={`Tirar a semana de ${s.week_start} da escala?`} className="text-xs text-scoop underline">
                    Remover
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Contas ({users.length})</h2>
        <ul className="divide-y divide-rule">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div>
                <p className="font-display text-lg font-bold">
                  {u.name}
                  {u.is_admin && <span className="ml-2 bg-ink px-1.5 py-0.5 align-middle font-sans text-[10px] font-bold uppercase text-white">admin</span>}
                </p>
                <p className="text-xs text-muted">@{u.username} · desde {formatDateTime(u.created_at)}</p>
              </div>
              <ResetPasswordButton userId={u.id} username={u.username} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
