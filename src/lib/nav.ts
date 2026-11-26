import type { Season } from "./seasons";

export type NavEntry = { href: string; label: string };
export type NavSection = { title: string; entries: NavEntry[] };

const SEASON_PAGES: Record<Season, NavEntry> = {
  natal: { href: "/natal", label: "🎄 Natal" },
  anonovo: { href: "/resolucoes", label: "🥂 Resoluções" },
  carnaval: { href: "/carnaval", label: "🎭 Carnaval" },
  cinzas: { href: "/carnaval", label: "🎭 Carnaval" },
  pascoa: { href: "/pascoa", label: "🐰 Caça aos ovos" },
};

export function navSections({ casinoOpen, season }: { casinoOpen: boolean; season: Season | null }): NavSection[] {
  const leisure: NavEntry[] = [
    { href: "/comedy-club", label: "Comedy Club" },
    ...(casinoOpen ? [{ href: "/casino", label: "Casino" }] : []),
    ...(season ? [SEASON_PAGES[season]] : []),
  ];
  return [
    {
      title: "O jornal",
      entries: [
        { href: "/", label: "Início" },
        { href: "/novo", label: "Escrever" },
        { href: "/meus", label: "Os meus posts" },
        { href: "/escala", label: "Escala" },
        { href: "/arquivo", label: "Arquivo" },
        { href: "/quadro", label: "Quadro" },
        { href: "/horoscopo", label: "Horóscopo" },
      ],
    },
    {
      title: "A associação",
      entries: [
        { href: "/assembleia", label: "Assembleia" },
        { href: "/decretos", label: "Decretos" },
        { href: "/cofre", label: "Cofre" },
        { href: "/regras", label: "Constituição" },
      ],
    },
    { title: "Lazer", entries: leisure },
  ];
}

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
