import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

export async function proxy(request: NextRequest) {
  const loggedIn = (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) !== null;
  const onLogin = request.nextUrl.pathname === "/login";
  if (!loggedIn && !onLogin) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|api/cron/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt)$).*)"],
};
