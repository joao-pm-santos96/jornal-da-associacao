"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { field, type FormState } from "@/lib/form";
import { loadEconomy } from "@/lib/economy";
import { getRules } from "@/lib/rules";
import { getNow, getSeason, lisbon } from "@/lib/seasons";
import { adventDay, adventSurprise, santaRevealed } from "@/lib/festas/natal";
import { resolutionYear, resolutionsRevealed } from "@/lib/festas/anonovo";
import { EGG_COUNT, eggSpots } from "@/lib/festas/pascoa";

const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export async function sendSantaCard(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const now = await getNow();
  const year = lisbon(now).year;
  if ((await getSeason()) !== "natal") return { error: "Os postais só se enviam no Natal." };
  if (santaRevealed(year, now)) return { error: "O amigo secreto já foi revelado. Os correios fecharam." };
  const body = field(form, "body");
  if (!body || body.length > 500) return { error: "Escreve o postal (máx. 500 caracteres)." };
  const rows = await sql`
    INSERT INTO santa_cards (year, from_id, to_id, body)
    SELECT ${year}, giver_id, receiver_id, ${body} FROM secret_santa WHERE year = ${year} AND giver_id = ${user.id}
    RETURNING id
  `;
  if (rows.length === 0) return { error: "Não estás no sorteio deste ano." };
  revalidatePath("/natal");
  return { ok: "Postal enviado. O teu segredo está seguro. 🎅" };
}

export async function openAdventDoor(door: number): Promise<void> {
  const R = await getRules();
  const user = await requireUser();
  const now = await getNow();
  if ((await getSeason()) !== "natal" || adventDay(now) !== door) return;
  const year = lisbon(now).year;
  const others = ((await sql`SELECT name FROM users WHERE id <> ${user.id} ORDER BY id`) as { name: string }[]).map(
    (u) => u.name,
  );
  const drawn = adventSurprise(year, door, user.id, others, R.adventPrize);
  const funded = drawn.kind !== "graos" || (await loadEconomy()).available >= R.adventPrize;
  const surprise = funded
    ? drawn
    : { kind: "piada" as const, payload: "Havia grãos de café no sapatinho, mas o Cofre está vazio. Fica a intenção. 🧦" };
  const inserted = await sql`
    INSERT INTO advent_doors (year, door, user_id, kind, payload)
    VALUES (${year}, ${door}, ${user.id}, ${surprise.kind}, ${surprise.payload})
    ON CONFLICT DO NOTHING RETURNING door
  `;
  if (inserted.length > 0 && surprise.kind === "graos") {
    await sql`
      INSERT INTO ledger (user_id, amount, reason, kind)
      VALUES (${user.id}, ${R.adventPrize}, ${`Calendário do Advento: porta ${door}`}, 'festa')
    `;
  }
  revalidatePath("/natal");
}

export async function saveResolutions(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if ((await getSeason()) !== "anonovo") return { error: "As resoluções só se escrevem no Ano Novo." };
  const year = resolutionYear(await getNow());
  const lines = [1, 2, 3].map((i) => field(form, `r${i}`)).filter(Boolean);
  if (lines.length === 0) return { error: "Escreve pelo menos uma resolução." };
  if (lines.some((l) => l.length > 200)) return { error: "Cada resolução tem no máximo 200 caracteres." };
  await sql`
    INSERT INTO resolutions (year, user_id, body) VALUES (${year}, ${user.id}, ${lines.join("\n")})
    ON CONFLICT (year, user_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()
    WHERE resolutions.simulated = EXCLUDED.simulated
  `;
  revalidatePath("/resolucoes");
  return { ok: `Resoluções seladas até dezembro de ${year}. 🔒` };
}

export async function voteResolution(year: number, targetId: number, kept: boolean): Promise<void> {
  const user = await requireUser();
  if (targetId === user.id || !resolutionsRevealed(year, await getNow())) return;
  await sql`
    INSERT INTO resolution_votes (year, user_id, voter_id, kept)
    SELECT ${year}, ${targetId}, ${user.id}, ${kept}
    WHERE EXISTS (SELECT 1 FROM resolutions WHERE year = ${year} AND user_id = ${targetId})
    ON CONFLICT (year, user_id, voter_id) DO UPDATE SET kept = EXCLUDED.kept
    WHERE resolution_votes.simulated = EXCLUDED.simulated
  `;
  revalidatePath("/resolucoes");
}

export async function collectEgg(egg: number): Promise<{ found: boolean; prize?: number }> {
  const R = await getRules();
  const user = await requireUser();
  if ((await getSeason()) !== "pascoa" || !Number.isInteger(egg) || egg < 1 || egg > EGG_COUNT) {
    return { found: false };
  }
  const year = lisbon(await getNow()).year;
  if (!(await eggSpots(year)).some((s) => s.egg === egg)) return { found: false };
  const inserted = await sql`
    INSERT INTO easter_eggs (year, egg, user_id) VALUES (${year}, ${egg}, ${user.id})
    ON CONFLICT DO NOTHING RETURNING egg
  `;
  if (inserted.length === 0) return { found: false };
  if ((await loadEconomy()).available >= R.egg) {
    await sql`
      INSERT INTO ledger (user_id, amount, reason, kind)
      VALUES (${user.id}, ${R.egg}, ${`Ovo da Páscoa n.º ${egg}`}, 'festa')
    `;
    return { found: true, prize: R.egg };
  }
  return { found: true, prize: 0 };
}

export async function setFakeNow(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.is_admin) return { error: "Sem permissões." };
  const local = field(form, "fake_now");
  if (local === "") {
    const purged = await sql.transaction([
      sql`DELETE FROM ledger WHERE simulated RETURNING id`,
      sql`DELETE FROM easter_eggs WHERE simulated RETURNING egg`,
      sql`DELETE FROM advent_doors WHERE simulated RETURNING door`,
      sql`DELETE FROM santa_cards WHERE simulated RETURNING id`,
      sql`DELETE FROM secret_santa WHERE simulated RETURNING year`,
      sql`DELETE FROM resolution_votes WHERE simulated RETURNING year`,
      sql`DELETE FROM resolutions WHERE simulated RETURNING year`,
      sql`DELETE FROM carnival_masks WHERE simulated RETURNING day`,
      sql`DELETE FROM bet_wagers WHERE simulated RETURNING id`,
      sql`DELETE FROM bets WHERE simulated RETURNING id`,
      sql`DELETE FROM slot_spins WHERE simulated RETURNING id`,
      sql`DELETE FROM scratch_tickets WHERE simulated RETURNING id`,
      sql`DELETE FROM duck_bets WHERE simulated RETURNING id`,
      sql`DELETE FROM duck_races WHERE simulated RETURNING id`,
      sql`DELETE FROM duels WHERE simulated RETURNING id`,
      sql`DELETE FROM pool_games WHERE simulated RETURNING id`,
      sql`DELETE FROM reflex_games WHERE simulated RETURNING id`,
      sql`DELETE FROM hilo_games WHERE simulated RETURNING id`,
      sql`DELETE FROM loans WHERE simulated RETURNING id`,
      sql`DELETE FROM comedy_votes WHERE simulated RETURNING voter_id`,
      sql`DELETE FROM comedy_weeks WHERE simulated RETURNING week_start`,
      sql`DELETE FROM comedy_jokes WHERE simulated RETURNING id`,
      sql`DELETE FROM payrolls WHERE simulated RETURNING week_start`,
      sql`DELETE FROM bonus_payments WHERE simulated RETURNING key`,
      sql`DELETE FROM subsidy_requests WHERE simulated RETURNING id`,
      sql`DELETE FROM post_highlights WHERE simulated RETURNING id`,
      sql`DELETE FROM nicknames WHERE simulated RETURNING id`,
      sql`DELETE FROM commissions WHERE simulated RETURNING id`,
      sql`DELETE FROM slush_moves WHERE simulated RETURNING id`,
      sql`DELETE FROM audits WHERE simulated RETURNING id`,
      sql`DELETE FROM scandals WHERE simulated RETURNING id`,
      sql`DELETE FROM notifications WHERE simulated RETURNING id`,
      sql`DELETE FROM assembly_votes WHERE simulated RETURNING assembly_id`,
      sql`DELETE FROM assembly_comments WHERE simulated RETURNING id`,
      sql`DELETE FROM assemblies WHERE simulated RETURNING id`,
      sql`DELETE FROM settings WHERE key = 'fake_now'`,
    ]);
    const removed = (purged as unknown[][]).slice(0, -1).reduce((n, rows) => n + rows.length, 0);
    revalidatePath("/", "layout");
    return {
      ok: removed
        ? `Máquina do tempo desligada. Apagados ${removed} registos da simulação. Bem-vindo ao presente.`
        : "Máquina do tempo desligada. Bem-vindo ao presente.",
    };
  }
  if (!LOCAL_DATETIME_RE.test(local)) return { error: "Escolhe uma data e hora." };
  await sql`
    INSERT INTO settings (key, value)
    VALUES ('fake_now', (${local}::timestamp AT TIME ZONE 'Europe/Lisbon')::text)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  revalidatePath("/", "layout");
  return { ok: "Máquina do tempo ligada." };
}
