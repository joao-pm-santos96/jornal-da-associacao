import { getUser } from "@/lib/auth";
import { countUnread } from "@/lib/posts";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ count: 0 }, { status: 401 });
  return Response.json({ count: await countUnread(user.id) }, { headers: { "Cache-Control": "no-store" } });
}
