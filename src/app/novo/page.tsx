import { PostEditor } from "@/components/PostEditor";
import { currentEdition } from "@/lib/dates";
import { savePost } from "@/app/actions";

export default function NewPostPage() {
  return (
    <div>
      <h1 className="mb-4 font-display text-4xl font-black">Novo post</h1>
      <PostEditor action={savePost.bind(null, null)} initial={{ title: "", body: "", edition: currentEdition(), publishAt: "" }} />
    </div>
  );
}
