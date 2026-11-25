"use server";

import { requireUser } from "@/lib/auth";
import { markNoticesRead } from "@/lib/notifications";

export async function markAllNoticesRead(): Promise<void> {
  const user = await requireUser();
  await markNoticesRead(user.id);
}
