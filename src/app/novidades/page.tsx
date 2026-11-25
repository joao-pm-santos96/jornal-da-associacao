import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { NOTICE_DAYS, listNotices } from "@/lib/notifications";
import { listUnread } from "@/lib/posts";
import { ActivityBox } from "@/components/ActivityBox";
import { NoticesSeen } from "./NoticesSeen";

export default async function NewsPage() {
  const user = await requireUser();
  const [notices, activity] = await Promise.all([listNotices(user.id), listUnread(user.id)]);
  const unread = notices.filter((n) => n.read_at === null).length;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <NoticesSeen unread={unread} />
      <header className="border-b-4 border-ink pb-3">
        <h1 className="font-display text-4xl font-black">Novidades</h1>
        <p className="text-sm text-muted">Tudo o que te chegou por notificação nos últimos {NOTICE_DAYS} dias, e o que tens por ler no jornal.</p>
      </header>

      {activity.length > 0 && <ActivityBox activity={activity} />}

      <section>
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">
          Avisos{unread > 0 && <span className="ml-2 align-middle text-sm font-bold text-scoop">{unread} {unread === 1 ? "novo" : "novos"}</span>}
        </h2>
        {notices.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sem avisos. Está tudo calmo na Associação.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {notices.map((n) => (
              <li key={n.id}>
                <Link href={n.url} className={`block px-2 py-3 hover:bg-flash ${n.read_at === null ? "border-l-4 border-scoop bg-white" : ""}`}>
                  <span className="block font-bold">{n.title}</span>
                  <span className="block text-sm">{n.body}</span>
                  <span className="block text-xs text-muted">{formatDateTime(n.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
