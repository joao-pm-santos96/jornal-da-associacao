import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPost, listComments } from "@/lib/posts";
import { editionLabel, formatDateTime, formatSchedule, timeAgo } from "@/lib/dates";
import { Markdown } from "@/components/Markdown";
import { ConfirmButton } from "@/components/ConfirmButton";
import { NewBadge } from "@/components/PostCard";
import { addComment, deleteComment, deletePost, editComment } from "@/app/actions";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [user, post] = await Promise.all([requireUser(), getPost(Number(id))]);
  const isAuthor = post?.author_id === user.id;
  if (!post || (!post.visible && !isAuthor && !user.is_admin)) notFound();

  const comments = post.visible ? await listComments(post.id) : [];

  return (
    <article>
      <Link href={`/edicao/${post.edition}`} className="text-sm font-bold uppercase tracking-widest text-scoop">
        Edição de {editionLabel(post.edition)}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-black leading-[1.05] sm:text-6xl">{post.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-ink pb-3 text-sm">
        <span>
          Por <strong>{post.author_name}</strong>
          {post.visible && post.publish_at && <> · {formatDateTime(post.publish_at)}</>}
        </span>
        {!post.visible && post.status === "draft" && (
          <span className="bg-ink px-2 py-0.5 text-xs font-bold uppercase text-white">Rascunho</span>
        )}
        {!post.visible && post.status !== "draft" && post.publish_at && (
          <span className="bg-flash px-2 py-0.5 text-xs font-bold uppercase">
            Agendado para {formatSchedule(post.publish_at)}
          </span>
        )}
        <span className="ml-auto flex gap-3">
          {isAuthor && (
            <Link href={`/post/${post.id}/editar`} className="font-semibold underline hover:text-scoop">
              Editar
            </Link>
          )}
          {(isAuthor || user.is_admin) && (
            <form action={deletePost.bind(null, post.id)}>
              <ConfirmButton message="Apagar este post e os comentários?" className="font-semibold text-scoop underline">
                Apagar
              </ConfirmButton>
            </form>
          )}
        </span>
      </div>

      <div className="mt-6">
        <Markdown>{post.body_md}</Markdown>
      </div>

      <section className="mt-12 border-t-4 border-ink pt-4">
        <h2 className="font-display text-2xl font-black">
          {post.visible ? `Comentários (${comments.length})` : "Comentários"}
        </h2>
        {!post.visible ? (
          <p className="mt-2 text-muted">Os comentários abrem quando o post for publicado.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="border-l-4 border-rule pl-3">
                  <p className="text-xs text-muted">
                    {user.seen_before && c.author_id !== user.id && c.created_at > user.seen_before && <NewBadge />}
                    <strong className="text-ink">{c.author_name}</strong> ·{" "}
                    <time dateTime={c.created_at.toISOString()} title={formatDateTime(c.created_at)}>
                      {timeAgo(c.created_at)}
                    </time>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
                  <div className="mt-1 flex gap-3 text-xs">
                    {c.author_id === user.id && (
                      <details>
                        <summary className="cursor-pointer underline">Editar</summary>
                        <form action={editComment.bind(null, c.id)} className="mt-2 space-y-2">
                          <textarea
                            name="body"
                            defaultValue={c.body}
                            required
                            maxLength={2000}
                            rows={3}
                            className="w-full border border-ink bg-white p-2 text-sm"
                          />
                          <button className="bg-ink px-3 py-1 font-bold uppercase text-white">Guardar</button>
                        </form>
                      </details>
                    )}
                    {(c.author_id === user.id || user.is_admin) && (
                      <form action={deleteComment.bind(null, c.id)}>
                        <ConfirmButton message="Apagar este comentário?" className="text-scoop underline">
                          Apagar
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <form action={addComment.bind(null, post.id)} className="mt-6 space-y-2">
              <label htmlFor="comment" className="text-sm font-semibold">
                Deixa a tua opinião
              </label>
              <textarea
                id="comment"
                name="body"
                required
                maxLength={2000}
                rows={3}
                className="w-full border-2 border-ink bg-white p-2"
              />
              <button className="bg-ink px-4 py-2 text-sm font-bold uppercase text-white hover:bg-scoop">Comentar</button>
            </form>
          </>
        )}
      </section>
    </article>
  );
}
