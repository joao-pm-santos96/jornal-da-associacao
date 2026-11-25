import { after } from "next/server";
import { getUser } from "@/lib/auth";
import { countNews } from "@/lib/notifications";
import { flushDueNotifications } from "@/lib/push";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ count: 0 }, { status: 401 });
  after(flushDueNotifications);
  return Response.json({ count: await countNews(user.id) }, { headers: { "Cache-Control": "no-store" } });
}
