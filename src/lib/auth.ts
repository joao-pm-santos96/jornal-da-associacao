import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token";

export type User = { id: number; name: string; username: string; is_admin: boolean; seen_before: Date | null };

export const getUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const id = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (id === null) return null;
  const rows = (await sql`
    UPDATE users SET
      seen_before = CASE
        WHEN last_seen_at IS NULL OR last_seen_at < now() - interval '30 minutes' THEN last_seen_at
        ELSE seen_before
      END,
      last_seen_at = now()
    WHERE id = ${id}
    RETURNING id, name, username, is_admin, seen_before
  `) as User[];
  return rows[0] ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function startSession(userId: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
