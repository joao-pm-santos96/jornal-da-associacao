import type { Metadata } from "next";
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
import { formatDateTime } from "@/lib/dates";
import { logout } from "./actions";
import "./globals.css";

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["700", "800", "900"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  description: "O jornal mensal cá da associação.",
  robots: { index: false, follow: false },
};

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
      <body className="min-h-screen">
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
              <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
                <UnreadBadge initial={unread} />
                <Link href="/" className="hover:text-scoop">Início</Link>
                <Link href="/novo" className="hover:text-scoop">Escrever</Link>
                <Link href="/meus" className="hover:text-scoop">Os meus</Link>
                <Link href="/quadro" className="hover:text-scoop">Quadro</Link>
                <Link href="/horoscopo" className="hover:text-scoop">Horóscopo</Link>
                <Link href="/regras" className="hover:text-scoop">Constituição</Link>
                <Link href="/decretos" className="hover:text-scoop">Decretos</Link>
                <Link href="/cofre" className="hover:text-scoop" title="O teu saldo no Cofre">🫘 {myBalance}</Link>
                <Link href="/conta" className="hover:text-scoop">Conta</Link>
                {user.is_admin && <Link href="/admin" className="hover:text-scoop">Admin</Link>}
                <form action={logout}>
                  <button className="uppercase hover:text-scoop">Sair</button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <main className="relative mx-auto max-w-4xl px-4 py-6">
          {children}
          {user && season === "pascoa" && <EggLayer />}
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
      </body>
    </html>
  );
}
