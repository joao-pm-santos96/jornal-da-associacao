import Link from "next/link";
import { excerpt, type PostSummary } from "@/lib/posts";
import { formatDateTime } from "@/lib/dates";

function commentLabel(n: number): string {
  return n === 1 ? "1 comentário" : `${n} comentários`;
}

export function PostMeta({ post }: { post: PostSummary }) {
  return (
    <p className="text-xs uppercase tracking-wider text-muted">
      Por <span className="font-semibold text-ink">{post.author_name}</span> · {formatDateTime(post.publish_at)} ·{" "}
      <span className="text-scoop">{commentLabel(post.comment_count)}</span>
    </p>
  );
}

export function Headline({ post }: { post: PostSummary }) {
  return (
    <article className="border-b-2 border-ink pb-6">
      <span className="inline-block -rotate-2 bg-flash px-2 py-0.5 text-xs font-black uppercase tracking-widest">
        Manchete
      </span>
      <Link href={`/post/${post.id}`} className="group block">
        <h2 className="mt-2 font-display text-4xl font-black leading-[1.05] group-hover:text-scoop sm:text-6xl">
          {post.title}
        </h2>
        <p className="mt-3 text-lg text-muted">{excerpt(post.body_md, 260)}</p>
      </Link>
      <div className="mt-3">
        <PostMeta post={post} />
      </div>
    </article>
  );
}

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="border-b border-rule py-4">
      <Link href={`/post/${post.id}`} className="group block">
        <h3 className="font-display text-2xl font-extrabold leading-tight group-hover:text-scoop">{post.title}</h3>
        <p className="mt-1 text-muted">{excerpt(post.body_md)}</p>
      </Link>
      <div className="mt-2">
        <PostMeta post={post} />
      </div>
    </article>
  );
}
