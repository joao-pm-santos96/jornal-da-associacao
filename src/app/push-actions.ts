"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { pushToUsers } from "@/lib/push";

export type SubscriptionJson = { endpoint: string; keys: { p256dh: string; auth: string } };

function valid(sub: SubscriptionJson): boolean {
  const ok = (s: unknown, max: number) => typeof s === "string" && s.length > 0 && s.length <= max;
  return ok(sub?.endpoint, 1000) && sub.endpoint.startsWith("https://") && ok(sub.keys?.p256dh, 200) && ok(sub.keys?.auth, 100);
}

export async function savePushSubscription(sub: SubscriptionJson): Promise<boolean> {
  const user = await requireUser();
  if (!valid(sub)) return false;
  await sql`
    INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth)
    VALUES (${sub.endpoint}, ${user.id}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;
  return true;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const user = await requireUser();
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${user.id}`;
}

export async function sendTestPush(): Promise<number> {
  const user = await requireUser();
  return pushToUsers([user.id], {
    title: "🔔 Notificações ligadas",
    body: "Se estás a ler isto, o Jornal já te consegue chatear. Bom café! ☕",
    url: "/conta",
    inbox: false,
  });
}
