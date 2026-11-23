import Link from "next/link";

export const felt = "bg-[#0b6b3a] text-[#fff6d6]";
export const gold = "text-[#f2c230]";

export function Marquee({ small = false }: { small?: boolean }) {
  return (
    <div className="border-[6px] border-dotted border-[#f2c230] bg-[#141414] px-4 py-5 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#f2c230]">★ Aberto 24h · Fiado não ★</p>
      <Link href="/casino" className="block">
        <span
          className={`inline-block -rotate-2 font-display font-black uppercase leading-none text-[#f2c230] [text-shadow:4px_4px_0_#e10600] ${
            small ? "text-4xl" : "text-6xl sm:text-7xl"
          }`}
        >
          Casino
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
