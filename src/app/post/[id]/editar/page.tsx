import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEditablePost } from "@/lib/posts";
import { PostEditor } from "@/components/PostEditor";
import { savePost } from "@/app/actions";

const STATUS_LABEL = { draft: "rascunho", scheduled: "agendado", published: "publicado" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const user = await requireUser();
  const post = await getEditablePost(Number(id), user.id);
  if (!post) notFound();

  const status = post.status !== "draft" && post.visible ? STATUS_LABEL.published : STATUS_LABEL[post.status];
  return (
    <div>
      <h1 className="font-display text-4xl font-black">Editar post</h1>
      <p className="mb-4 text-sm text-muted">Estado atual: {status}</p>
      <PostEditor
        action={savePost.bind(null, post.id)}
        initial={{
          title: post.title,
          body: post.body_md,
          edition: post.edition,
          publishAt: post.status === "scheduled" && !post.visible ? (post.publish_at_local ?? "") : "",
        }}
      />
    </div>
  );
}
