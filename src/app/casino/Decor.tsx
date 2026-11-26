import Link from "next/link";
import { isOpen } from "@/lib/modules";

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

const HAZARD = "bg-[repeating-linear-gradient(-45deg,#fff_0_16px,#e10600_16px_32px)]";

export async function Marquee({ small = false }: { small?: boolean }) {
  const open = await isOpen("casino");
  return (
    <div className="relative overflow-hidden bg-[#141414] px-8 py-9 text-center">
      {open && <Bulbs />}
      <div className={open ? "" : "opacity-30 grayscale"} aria-hidden={!open}>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#f2c230]">★ Aberto 24h · Fiado não ★</p>
        <Link href="/casino" className="block" tabIndex={open ? undefined : -1}>
          <span
            className={`inline-block -rotate-2 font-display font-black uppercase leading-none text-[#f2c230] [text-shadow:4px_4px_0_#e10600] ${
              small ? "text-4xl" : "text-6xl sm:text-7xl"
            }`}
          >
            Ca<span className={open ? "casino-dead-bulb" : ""}>s</span>ino
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
      {!open && <Sealed small={small} />}
    </div>
  );
}

function Sealed({ small }: { small: boolean }) {
  return (
    <div role="status" className="absolute inset-0 flex items-center justify-center">
      <div aria-hidden="true" className={`absolute -inset-x-8 top-3 flex h-8 -rotate-[5deg] items-center justify-center ${HAZARD}`}>
        <span className="bg-white px-2 text-sm font-black uppercase tracking-[0.3em] text-[#e10600]">Interdito</span>
      </div>
      <div aria-hidden="true" className={`absolute -inset-x-8 -bottom-1 h-6 rotate-[3deg] ${HAZARD}`} />
      <div className={`relative mx-4 mt-6 max-w-xs rotate-[3deg] border-2 border-[#141414] bg-paper text-left text-ink shadow-[4px_4px_0_#e10600] ${small ? "px-3 py-1.5" : "px-4 py-3"}`}>
        <p className="text-xs font-black uppercase tracking-wider">Auto de selagem n.º 0</p>
        <p className={`leading-snug ${small ? "text-[11px]" : "text-xs"}`}>
          Estabelecimento selado por ordem da Administração. Não violar. Não se aceitam apostas novas; o que já está em jogo resolve-se normalmente.
        </p>
        <span className="mt-1 inline-block -rotate-[8deg] border-2 border-[#e10600] px-1.5 text-xs font-black uppercase text-[#e10600]">Selado</span>
      </div>
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
