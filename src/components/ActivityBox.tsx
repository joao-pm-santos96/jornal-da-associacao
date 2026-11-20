import Link from "next/link";
import type { Activity } from "@/lib/posts";

function describe(a: Activity): string {
  const parts = [];
  if (a.is_new) parts.push("post novo");
  if (a.new_comment_count === 1) parts.push("1 comentário novo");
  if (a.new_comment_count > 1) parts.push(`${a.new_comment_count} comentários novos`);
  return parts.join(" · ");
}

export function ActivityBox({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) return null;
  return (
    <aside id="por-ler" className="scroll-mt-4 border-2 border-ink bg-flash p-4">
      <h2 className="font-display text-xl font-black">Por ler</h2>
      <ul className="mt-2 space-y-1">
        {activity.map((a) => (
          <li key={a.id}>
            <Link href={`/post/${a.id}`} className="font-semibold underline hover:text-scoop">{a.title}</Link>
            <span className="text-sm"> · {describe(a)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
