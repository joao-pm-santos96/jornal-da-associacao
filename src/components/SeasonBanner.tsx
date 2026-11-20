import Link from "next/link";
import type { Season } from "@/lib/seasons";

const BANNERS: Record<Season, { title: string; text: string; links: { href: string; label: string }[] }> = {
  natal: {
    title: "🎄 Chegou o Natal à Associação",
    text: "O Amigo Secreto já foi sorteado e há uma porta do Calendário do Advento à tua espera.",
    links: [{ href: "/natal", label: "Amigo Secreto e Advento" }],
  },
  anonovo: {
    title: "🥂 Ano novo, jornal novo",
    text: "Vê o resumo do ano e sela as tuas resoluções numa cápsula do tempo.",
    links: [{ href: "/resolucoes", label: "Resoluções" }],
  },
  carnaval: {
    title: "🎭 É Carnaval, ninguém leva a mal",
    text: "Hoje toda a gente anda disfarçada. Os nomes que vês não são quem parecem.",
    links: [{ href: "/carnaval", label: "Descobre o teu disfarce" }],
  },
  cinzas: {
    title: "🎭 Caem as máscaras",
    text: "Acabou o Carnaval. Descobre quem andava disfarçado de quem.",
    links: [{ href: "/carnaval", label: "Ver a revelação" }],
  },
  pascoa: {
    title: "🐰 Caça aos ovos!",
    text: "Há ovos escondidos pelo jornal. Cada um vale tremoços.",
    links: [{ href: "/pascoa", label: "Regras e classificação" }],
  },
};

export function SeasonBanner({ season, extra }: { season: Season | null; extra?: { href: string; label: string }[] }) {
  if (!season) return null;
  const b = BANNERS[season];
  return (
    <aside className="border-2 border-ink bg-flash p-4">
      <p className="font-display text-2xl font-black">{b.title}</p>
      <p className="mt-1">{b.text}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
        {[...b.links, ...(extra ?? [])].map((l) => (
          <Link key={l.href} href={l.href} className="underline hover:text-scoop">{l.label} →</Link>
        ))}
      </p>
    </aside>
  );
}
