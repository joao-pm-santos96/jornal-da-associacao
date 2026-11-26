import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEditionPosts, listEditions, listHighlights, listUnread } from "@/lib/posts";
import { HighlightBox } from "@/components/HighlightBox";
import { ScandalBox } from "@/components/ScandalBox";
import { recentScandals } from "@/lib/slush";
import { editionLabel } from "@/lib/dates";
import { Headline, PostCard } from "@/components/PostCard";
import { ForYouBox } from "@/components/ForYouBox";
import { PendingAssemblies } from "@/components/PendingAssemblies";
import { listAssemblies, pendingExecution } from "@/lib/assembly";
import { RotaBrief, myTurn, summarizeRota } from "@/components/Rota";
import { getRota } from "@/lib/rota";
import { latestDecree } from "@/lib/decrees";
import { getOffices } from "@/lib/offices";
import { DecreeBanner } from "@/components/DecreeBanner";
import { SeasonBanner } from "@/components/SeasonBanner";
import { getNow, getSeason } from "@/lib/seasons";
import { reviewYear } from "@/lib/festas/anonovo";
import { featuredBet } from "@/lib/bets";
import { BetBanner } from "@/components/BetBanner";

async function Edition({ edition, userId, hasArchive, narrow }: { edition: string; userId: number; hasArchive: boolean; narrow: boolean }) {
  const [headline, ...rest] = await listEditionPosts(edition, userId);
  return (
    <section>
      <p className="mb-4 text-sm font-bold uppercase tracking-widest text-scoop">Edição de {editionLabel(edition)}</p>
      <Headline post={headline} />
      {rest.length > 0 && (
        <div className={`grid gap-x-8 sm:grid-cols-2 ${narrow ? "md:grid-cols-1" : ""}`}>
          {rest.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      {hasArchive && (
        <Link href="/arquivo" className="mt-6 inline-block text-sm font-bold uppercase tracking-wider underline hover:text-scoop">
          Edições anteriores →
        </Link>
      )}
    </section>
  );
}

function EmptyEdition() {
  return (
    <div className="py-16 text-center">
      <h2 className="font-display text-4xl font-black">Ainda não há notícias!</h2>
      <p className="mt-2 text-muted">A redação está vazia. Sê o primeiro a dar o furo.</p>
      <Link href="/novo" className="mt-6 inline-block bg-ink px-5 py-2 font-bold uppercase text-white hover:bg-scoop">
        Escrever um post
      </Link>
    </div>
  );
}

export default async function Home() {
  const user = await requireUser();
  const [editions, activity, rota, decree, offices, bet, highlights, scandals, assemblies, now, season] = await Promise.all([
    listEditions(),
    listUnread(user.id),
    getRota(),
    latestDecree(),
    getOffices(),
    featuredBet(),
    listHighlights(),
    recentScandals(),
    listAssemblies(user.id),
    getNow(),
    getSeason(),
  ]);
  const isPresident = offices.presidente?.user_id === user.id;
  const seasonExtra = season === "anonovo" ? [{ href: `/retrospetiva/${reviewYear(now)}`, label: `O ano de ${reviewYear(now)} em revista` }] : undefined;
  const votes = assemblies.filter((a) => a.status === "open" && !a.voted);
  const pending = assemblies.filter(pendingExecution);
  const rotaSummary = summarizeRota(rota);
  const hasBriefs = Boolean(season || scandals.length > 0 || decree || bet || rotaSummary || pending.length > 0);
  const [current] = editions;

  return (
    <div className="space-y-8">
      <ForYouBox votes={votes} turn={myTurn(rota, user.id)} unread={activity.length} isPresident={isPresident} />
      <div className={hasBriefs ? "grid gap-10 md:grid-cols-3 md:gap-8" : ""}>
        <div className="space-y-8 md:col-span-2">
          <HighlightBox highlights={highlights} />
          {current ? (
            <Edition edition={current.edition} userId={user.id} hasArchive={editions.length > 1} narrow={hasBriefs} />
          ) : (
            <EmptyEdition />
          )}
        </div>
        {hasBriefs && (
          <aside className="space-y-4" aria-labelledby="breves">
            <h2 id="breves" className="border-b-2 border-ink pb-1 font-display text-2xl font-black">Breves</h2>
            <SeasonBanner season={season} extra={seasonExtra} />
            <ScandalBox scandals={scandals} />
            <DecreeBanner decree={decree} />
            <BetBanner bet={bet} />
            {rotaSummary && <RotaBrief summary={rotaSummary} userId={user.id} />}
            {pending.length > 0 && <PendingAssemblies pending={pending} />}
          </aside>
        )}
      </div>
    </div>
  );
}
