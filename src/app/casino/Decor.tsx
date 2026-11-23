import Link from "next/link";

export const felt = "bg-[#0b6b3a] text-[#fff6d6]";
export const gold = "text-[#f2c230]";

const BULB_SIDES = [
  { start: 0, n: 16, className: "inset-x-2 top-2" },
  { start: 16, n: 5, className: "inset-y-8 right-2 flex-col" },
  { start: 21, n: 16, className: "inset-x-2 bottom-2 flex-row-reverse" },
  { start: 37, n: 5, className: "inset-y-8 left-2 flex-col-reverse" },
] as const;

function Bulbs() {
  return BULB_SIDES.map(({ start, n, className }) => (
    <div key={start} aria-hidden="true" className={`absolute flex justify-between ${className}`}>
      {Array.from({ length: n }, (_, k) => (
        <span key={k} className="casino-bulb" style={{ animationDelay: `${((start + k) % 3) * 0.2 - 0.6}s` }} />
      ))}
    </div>
  ));
}

export function Marquee({ small = false }: { small?: boolean }) {
  return (
    <div className="relative bg-[#141414] px-8 py-9 text-center">
      <Bulbs />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#f2c230]">★ Aberto 24h · Fiado não ★</p>
      <Link href="/casino" className="block">
        <span
          className={`inline-block -rotate-2 font-display font-black uppercase leading-none text-[#f2c230] [text-shadow:4px_4px_0_#e10600] ${
            small ? "text-4xl" : "text-6xl sm:text-7xl"
          }`}
        >
          Ca<span className="casino-dead-bulb">s</span>ino
        </span>
      </Link>
      <p className="mt-2 text-xs font-bold uppercase tracking-widest text-[#fff6d6]">
        da Associação · licença n.º 0 · fiscalizado por ninguém
      </p>
      <p className="mt-1 text-xl tracking-[0.5em]" aria-hidden="true">
        <span className="text-[#fff6d6]">♠</span>
        <span className="text-[#e10600]">♥</span>
        <span className="text-[#e10600]">♦</span>
        <span className="text-[#fff6d6]">♣</span>
      </p>
    </div>
  );
}

export function Chip({ value, label, tone = "red" }: { value: string; label: string; tone?: "red" | "black" }) {
  const colors = tone === "red" ? "bg-[#e10600] text-white" : "bg-[#141414] text-[#f2c230]";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-dashed border-white ${colors} font-display text-2xl font-black outline outline-2 outline-offset-0 outline-[#141414]`}
      >
        {value}
      </div>
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function Sticker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block rotate-3 border-2 border-[#141414] bg-[#f2c230] px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#141414] ${className}`}
    >
      {children}
    </span>
  );
}

export function Disclaimer() {
  return (
    <p className="text-center text-[11px] italic opacity-80">
      Jogue com responsabilidade. Ou não: são grãos de café. Proibido a menores de 30 e a quem deve dinheiro ao Tesoureiro.
    </p>
  );
}
