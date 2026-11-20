import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEditionPosts, listEditions, listUnread } from "@/lib/posts";
import { editionLabel } from "@/lib/dates";
import { Headline, PostCard } from "@/components/PostCard";
import { ActivityBox } from "@/components/ActivityBox";
import { RotaBanner } from "@/components/RotaBanner";
import { getRota } from "@/lib/rota";
import { latestDecree } from "@/lib/decrees";
import { getOffices } from "@/lib/offices";
import { DecreeBanner, PresidentShortcut } from "@/components/DecreeBanner";

export default async function Home() {
  const user = await requireUser();
  const [editions, activity, rota, decree, offices] = await Promise.all([
    listEditions(),
    listUnread(user.id),
    getRota(),
    latestDecree(),
    getOffices(),
  ]);
  const isPresident = offices.presidente?.user_id === user.id;
  if (editions.length === 0) {
    return (
      <div className="space-y-10">
        {isPresident && <PresidentShortcut />}
        <DecreeBanner decree={decree} />
        <RotaBanner rota={rota} userId={user.id} isPresident={isPresident} />
        <div className="py-16 text-center">
          <h2 className="font-display text-4xl font-black">Ainda não há notícias!</h2>
          <p className="mt-2 text-muted">A redação está vazia. Sê o primeiro a dar o furo.</p>
          <Link href="/novo" className="mt-6 inline-block bg-ink px-5 py-2 font-bold uppercase text-white hover:bg-scoop">
            Escrever um post
          </Link>
        </div>
      </div>
    );
  }

  const [current, ...previous] = editions;
  const [headline, ...rest] = await listEditionPosts(current.edition, user.id);

  return (
    <div className="space-y-10">
      {isPresident && <PresidentShortcut />}
        <DecreeBanner decree={decree} />
        <RotaBanner rota={rota} userId={user.id} isPresident={isPresident} />
      <ActivityBox activity={activity} />
      <section>
        <p className="mb-4 text-sm font-bold uppercase tracking-widest text-scoop">
          Edição de {editionLabel(current.edition)}
        </p>
        <Headline post={headline} />
        {rest.length > 0 && (
          <div className="grid gap-x-8 sm:grid-cols-2">
            {rest.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      {previous.length > 0 && (
        <section>
          <h2 className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Edições anteriores</h2>
          <ul className="divide-y divide-rule">
            {previous.map((e) => (
              <li key={e.edition}>
                <Link href={`/edicao/${e.edition}`} className="flex justify-between py-3 hover:text-scoop">
                  <span className="font-display text-xl font-bold">{editionLabel(e.edition)}</span>
                  <span className="text-sm text-muted">{e.post_count === 1 ? "1 post" : `${e.post_count} posts`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
