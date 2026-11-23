import { flushDueNotifications } from "@/lib/push";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  await flushDueNotifications();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
