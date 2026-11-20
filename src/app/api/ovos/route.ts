import { getUser } from "@/lib/auth";
import { getNow, lisbon, seasonFor } from "@/lib/seasons";
import { eggSpots, foundEggs } from "@/lib/festas/pascoa";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ eggs: [] }, { status: 401 });
  const now = await getNow();
  if (seasonFor(now) !== "pascoa") return Response.json({ eggs: [] });
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const year = lisbon(now).year;
  const [spots, found] = await Promise.all([eggSpots(year), foundEggs(year, user.id)]);
  const eggs = spots.filter((s) => s.path === path && !found.includes(s.egg));
  return Response.json({ eggs }, { headers: { "Cache-Control": "no-store" } });
}
