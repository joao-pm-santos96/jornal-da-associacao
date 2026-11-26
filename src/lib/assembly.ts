import "server-only";
import { sql } from "./db";
import { getOffices } from "./offices";

export type AssemblyKind = "sim_nao" | "opcoes";
export type AssemblyStatus = "open" | "closed" | "void";
export type Outcome = "aprovada" | "rejeitada" | "escolhida" | "empate" | "sem_votos";

export const YES_NO = ["Sim", "Não", "Abstenção"] as const;

export const DURATIONS = [
  { hours: 2, label: "2 horas" },
  { hours: 12, label: "12 horas" },
  { hours: 24, label: "1 dia" },
  { hours: 48, label: "2 dias" },
  { hours: 72, label: "3 dias" },
  { hours: 168, label: "7 dias" },
] as const;

export const REMINDER_HOURS = 12;

export type AssemblySummary = {
  id: number;
  title: string;
  kind: AssemblyKind;
  secret: boolean;
  binding: boolean;
  constitutional: boolean;
  status: AssemblyStatus;
  closes_at: Date;
  closed_at: Date | null;
  outcome: Outcome | null;
  winner: string | null;
  casting: boolean;
  done_at: Date | null;
  created_by: number | null;
  author: string | null;
  voters: number;
  voted: boolean;
};

export type AssemblyOption = { id: number; position: number; label: string; votes: number };
export type AssemblyVote = { user_id: number; name: string; option_id: number };
export type AssemblyComment = { id: number; author_id: number; author: string; body: string; created_at: Date };

export type AssemblyDetail = AssemblySummary & {
  body: string;
  done_by: string | null;
  options: AssemblyOption[];
  votes: AssemblyVote[];
  comments: AssemblyComment[];
  mine: number | null;
  members: number;
};

export function outcomeLabel(a: Pick<AssemblySummary, "status" | "outcome" | "winner" | "casting">): string {
  if (a.status === "void") return "Anulada";
  if (a.status === "open") return "Em votação";
  const casting = a.casting ? " (voto de qualidade do Presidente)" : "";
  switch (a.outcome) {
    case "aprovada":
      return `Aprovada${casting}`;
    case "rejeitada":
      return `Rejeitada${casting}`;
    case "escolhida":
      return `Venceu «${a.winner}»${casting}`;
    case "empate":
      return "Empate: nada decidido";
    default:
      return "Ninguém votou";
  }
}

export function pendingExecution(a: Pick<AssemblySummary, "status" | "binding" | "outcome" | "done_at">): boolean {
  return a.status === "closed" && a.binding && a.done_at === null && (a.outcome === "aprovada" || a.outcome === "escolhida");
}

const SUMMARY = `
  a.id, a.title, a.kind, a.secret, a.binding, a.constitutional, a.status, a.closes_at, a.closed_at, a.outcome,
  a.casting, a.done_at, a.created_by,
  CASE WHEN a.created_by IS NULL THEN NULL ELSE member_label(a.created_by) END AS author,
  (SELECT o.label FROM assembly_options o WHERE o.id = a.winning_option) AS winner,
  (SELECT count(*) FROM assembly_votes v WHERE v.assembly_id = a.id)::int AS voters,
  EXISTS (SELECT 1 FROM assembly_votes v WHERE v.assembly_id = a.id AND v.user_id = $1) AS voted
`;

export async function listAssemblies(viewerId: number): Promise<AssemblySummary[]> {
  return (await sql.query(
    `SELECT ${SUMMARY} FROM assemblies a
     ORDER BY a.status = 'open' DESC, CASE WHEN a.status = 'open' THEN a.closes_at END ASC, a.id DESC`,
    [viewerId],
  )) as AssemblySummary[];
}

export async function getAssembly(id: number, viewerId: number): Promise<AssemblyDetail | null> {
  const [row] = (await sql.query(
    `SELECT ${SUMMARY}, a.body, CASE WHEN a.done_by IS NULL THEN NULL ELSE member_label(a.done_by) END AS done_by,
       (SELECT count(*) FROM users)::int AS members
     FROM assemblies a WHERE a.id = $2`,
    [viewerId, id],
  )) as Omit<AssemblyDetail, "options" | "votes" | "comments" | "mine">[];
  if (!row) return null;
  const [options, votes, comments] = await Promise.all([
    sql`
      SELECT o.id, o.position, o.label, count(v.user_id)::int AS votes
      FROM assembly_options o LEFT JOIN assembly_votes v ON v.option_id = o.id
      WHERE o.assembly_id = ${id} GROUP BY o.id ORDER BY o.position
    `,
    sql`
      SELECT v.user_id, member_label(v.user_id) AS name, v.option_id FROM assembly_votes v
      WHERE v.assembly_id = ${id} ORDER BY v.voted_at
    `,
    sql`
      SELECT c.id, c.author_id, member_label(c.author_id) AS author, c.body, c.created_at FROM assembly_comments c
      WHERE c.assembly_id = ${id} ORDER BY c.created_at, c.id
    `,
  ]);
  const allVotes = votes as AssemblyVote[];
  return {
    ...row,
    options: options as AssemblyOption[],
    votes: allVotes,
    comments: comments as AssemblyComment[],
    mine: allVotes.find((v) => v.user_id === viewerId)?.option_id ?? null,
  };
}

type Tally = { outcome: Outcome; winning: number | null; casting: boolean };

export function tally(kind: AssemblyKind, constitutional: boolean, options: AssemblyOption[], presidentChoice: number | null): Tally {
  if (kind === "sim_nao") {
    const yes = options.find((o) => o.position === 1);
    const no = options.find((o) => o.position === 2);
    const y = yes?.votes ?? 0;
    const n = no?.votes ?? 0;
    if (y + n === 0) return { outcome: "sem_votos", winning: null, casting: false };
    if (constitutional) return { outcome: 3 * y >= 2 * (y + n) ? "aprovada" : "rejeitada", winning: null, casting: false };
    if (y !== n) return { outcome: y > n ? "aprovada" : "rejeitada", winning: null, casting: false };
    if (presidentChoice !== null && presidentChoice === yes?.id) return { outcome: "aprovada", winning: null, casting: true };
    if (presidentChoice !== null && presidentChoice === no?.id) return { outcome: "rejeitada", winning: null, casting: true };
    return { outcome: "empate", winning: null, casting: false };
  }
  const max = Math.max(0, ...options.map((o) => o.votes));
  if (max === 0) return { outcome: "sem_votos", winning: null, casting: false };
  const top = options.filter((o) => o.votes === max);
  if (top.length === 1) return { outcome: "escolhida", winning: top[0].id, casting: false };
  const pick = top.find((o) => o.id === presidentChoice);
  if (pick) return { outcome: "escolhida", winning: pick.id, casting: true };
  return { outcome: "empate", winning: null, casting: false };
}

export type ClosedAssembly = Pick<AssemblySummary, "id" | "title" | "status" | "outcome" | "winner" | "casting">;

export async function closeDueAssemblies(): Promise<ClosedAssembly[]> {
  const due = (await sql`
    SELECT a.id, a.kind, a.constitutional FROM assemblies a
    WHERE a.status = 'open' AND (
      a.closes_at <= now()
      OR (SELECT count(*) FROM assembly_votes v WHERE v.assembly_id = a.id) >= (SELECT count(*) FROM users)
    )
  `) as { id: number; kind: AssemblyKind; constitutional: boolean }[];
  if (due.length === 0) return [];
  const president = (await getOffices()).presidente?.user_id ?? null;
  const closed: ClosedAssembly[] = [];
  for (const a of due) {
    const [options, choice] = await Promise.all([
      sql`
        SELECT o.id, o.position, o.label, count(v.user_id)::int AS votes
        FROM assembly_options o LEFT JOIN assembly_votes v ON v.option_id = o.id
        WHERE o.assembly_id = ${a.id} GROUP BY o.id ORDER BY o.position
      `,
      president === null
        ? Promise.resolve([])
        : sql`SELECT option_id FROM assembly_votes WHERE assembly_id = ${a.id} AND user_id = ${president}`,
    ]);
    const t = tally(a.kind, a.constitutional, options as AssemblyOption[], (choice as { option_id: number }[])[0]?.option_id ?? null);
    const [row] = (await sql`
      UPDATE assemblies SET status = 'closed', closed_at = now(), outcome = ${t.outcome}, winning_option = ${t.winning}, casting = ${t.casting}
      WHERE id = ${a.id} AND status = 'open'
      RETURNING id, title, status, outcome, casting,
        (SELECT o.label FROM assembly_options o WHERE o.id = ${t.winning}) AS winner
    `) as ClosedAssembly[];
    if (row) closed.push(row);
  }
  return closed;
}

export async function dueReminders(): Promise<{ id: number; title: string; missing: number[] }[]> {
  return (await sql`
    UPDATE assemblies a SET reminder_notified_at = now()
    WHERE a.status = 'open' AND a.reminder_notified_at IS NULL AND a.closes_at > now()
      AND a.closes_at <= now() + make_interval(hours => ${REMINDER_HOURS})
      AND a.created_at <= now() - make_interval(hours => 1)
    RETURNING a.id, a.title,
      array(SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM assembly_votes v WHERE v.assembly_id = a.id AND v.user_id = u.id)) AS missing
  `) as { id: number; title: string; missing: number[] }[];
}
