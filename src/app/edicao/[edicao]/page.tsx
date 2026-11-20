import { notFound } from "next/navigation";
import { listEditionPosts } from "@/lib/posts";
import { EDITION_RE, editionLabel } from "@/lib/dates";
import { Headline, PostCard } from "@/components/PostCard";

export default async function EditionPage({ params }: { params: Promise<{ edicao: string }> }) {
  const { edicao } = await params;
  if (!EDITION_RE.test(edicao)) notFound();
  const [headline, ...rest] = await listEditionPosts(edicao);
  if (!headline) notFound();

  return (
    <section>
      <h1 className="mb-4 text-sm font-bold uppercase tracking-widest text-scoop">Edição de {editionLabel(edicao)}</h1>
      <Headline post={headline} />
      <div className="grid gap-x-8 sm:grid-cols-2">
        {rest.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
