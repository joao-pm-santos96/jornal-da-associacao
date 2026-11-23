import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter, Playfair_Display } from "next/font/google";
import { getUser } from "@/lib/auth";
import { countUnread } from "@/lib/posts";
import { UnreadBadge } from "@/components/UnreadBadge";
import { Masthead } from "@/components/Masthead";
import { getBalances } from "@/lib/economy";
import { SEASON_INFO, getFakeNow, getNow, lisbon, seasonFor } from "@/lib/seasons";
import { ensureMasks } from "@/lib/festas/carnaval";
import { isNewYearMoment } from "@/lib/festas/anonovo";
import { Falling } from "@/components/Falling";
import { EggLayer } from "@/components/EggLayer";
import { ServiceWorker } from "@/components/ServiceWorker";
import { formatDateTime } from "@/lib/dates";
import { AccountMenu } from "@/components/AccountMenu";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["700", "800", "900"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  description: "O jornal mensal cá da associação.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Jornal", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#e10600", viewportFit: "cover" };

const today = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const [now, fakeNow] = await Promise.all([getNow(), getFakeNow()]);
  const season = seasonFor(now);
  const lisbonNow = lisbon(now);
  if (season === "carnaval") await ensureMasks(lisbonNow.date);
  const [unread, balances] = user ? await Promise.all([countUnread(user.id), getBalances()]) : [0, []];
  const myBalance = user ? balances.find((b) => b.user_id === user.id)?.balance ?? 0 : 0;
  return (
    <html lang="pt-PT" data-tema={season ?? undefined} className={`${playfair.variable} ${inter.variable} antialiased`}>
      <body className={`min-h-screen ${user ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0" : ""}`}>
        {!user && <title>Jornal da Associação</title>}
        {fakeNow && (
          <p className="bg-ink px-4 py-1 text-center text-xs font-bold text-flash">
            ⏰ Máquina do tempo ligada: o jornal acha que é {formatDateTime(fakeNow)}
          </p>
        )}
        {season === "natal" && <Falling emojis={["❄️", "❅", "❆"]} count={18} />}
        {season === "anonovo" && isNewYearMoment(now) && <Falling emojis={["🎉", "🎊", "🥂", "✨"]} count={40} burst />}
        <header className="border-b-4 border-ink">
          <div className="bg-scoop text-white">
            <div className="mx-auto max-w-4xl px-4 py-3 text-center">
              <Masthead tag={season ? `${SEASON_INFO[season].emoji} ${SEASON_INFO[season].tag}` : undefined} carnival={season === "carnaval"} />
            </div>
          </div>
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs uppercase tracking-wider">
            <span className="text-muted first-letter:uppercase">{today.format(now)}</span>
            {user && (
              <div className="flex items-center gap-4 font-semibold">
                <UnreadBadge initial={unread} />
                <Link href="/cofre" className="hidden hover:text-scoop md:inline" title="O teu saldo no Cofre">☕ {myBalance}</Link>
                <span className="hidden md:inline"><AccountMenu isAdmin={user.is_admin} /></span>
              </div>
            )}
          </div>
          {user && (
            <nav className="hidden border-t border-rule md:block" aria-label="Secções">
              <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 py-2 text-xs font-bold uppercase tracking-wider">
                <Link href="/" className="hover:text-scoop">Início</Link>
                <Link href="/novo" className="hover:text-scoop">Escrever</Link>
                <Link href="/meus" className="hover:text-scoop">Os meus</Link>
                <Link href="/quadro" className="hover:text-scoop">Quadro</Link>
                <Link href="/horoscopo" className="hover:text-scoop">Horóscopo</Link>
                <Link href="/casino" className="hover:text-scoop">Casino</Link>
                <Link href="/decretos" className="hover:text-scoop">Decretos</Link>
                <Link href="/regras" className="hover:text-scoop">Constituição</Link>
              </div>
            </nav>
          )}
        </header>
        <main className="relative mx-auto max-w-4xl px-4 py-6">
          {children}
          {user && season === "pascoa" && <EggLayer />}
          {user && <ServiceWorker />}
        </main>
        <footer className="mx-auto max-w-4xl border-t border-rule px-4 py-6 text-center text-xs text-muted">
          <p>Jornal da Associação · edição privada · não distribuir à concorrência</p>
          {user && (
            <a
              href="https://github.com/joao-pm-santos96/jornal-da-associacao/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block border border-ink px-3 py-1 font-semibold uppercase tracking-wider text-ink hover:bg-ink hover:text-white"
            >
              Reportar erro / sugestão
            </a>
          )}
        </footer>
        {user && <BottomNav balance={myBalance} isAdmin={user.is_admin} />}
      </body>
    </html>
  );
}
