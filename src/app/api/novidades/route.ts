import { after } from "next/server";
import { getUser } from "@/lib/auth";
import { countUnread } from "@/lib/posts";
import { flushDueNotifications } from "@/lib/push";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ count: 0 }, { status: 401 });
  after(flushDueNotifications);
  return Response.json({ count: await countUnread(user.id) }, { headers: { "Cache-Control": "no-store" } });
}
