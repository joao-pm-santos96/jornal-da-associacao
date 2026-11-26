import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ATTEMPTS, MAX_DELAY_MS, MIN_DELAY_MS } from "@/lib/reflex";
import { Disclaimer, Marquee, felt, gold } from "../../Decor";
import { ReflexPad } from "../ReflexPad";

export default async function ReflexPracticePage() {
  await requireUser();
  return (
    <div className={`-mx-4 -my-6 space-y-6 px-4 py-6 sm:mx-0 sm:border-4 sm:border-[#141414] ${felt}`}>
      <Marquee small />
      <p className="text-sm">
        <Link href="/casino/gatilho" className="underline">← Voltar ao Gatilho</Link>
      </p>
      <header className="text-center">
        <h1 className={`font-display text-4xl font-black uppercase ${gold} [text-shadow:3px_3px_0_#141414]`}>⚡ Gatilho</h1>
        <p className="text-sm font-bold uppercase tracking-widest">Treino · sem grãos em jogo</p>
      </header>

      <div className="mx-auto max-w-md">
        <ReflexPad mode="practice" />
      </div>

      <section className="mx-auto max-w-xl space-y-1 text-sm">
        <h2 className={`border-b-2 border-dashed border-[#f2c230] pb-1 font-display text-xl font-black uppercase ${gold}`}>Como se joga</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Toca no quadrado: fica vermelho e, entre {MIN_DELAY_MS / 1000} e {MAX_DELAY_MS / 1000} segundos depois, fica verde.</li>
          <li>Toca assim que ficar verde. Conta o tempo entre o verde e o teu toque.</li>
          <li>Tocar antes do verde conta como 1 segundo. Mais lento do que 1 segundo também.</li>
          <li>São {ATTEMPTS} tentativas e conta a média. O recorde fica guardado só neste telemóvel.</li>
        </ul>
      </section>

      <Disclaimer />
    </div>
  );
}
