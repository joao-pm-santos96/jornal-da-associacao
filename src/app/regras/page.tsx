import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOffices } from "@/lib/offices";
import { ECONOMY_START, TREMOCOS } from "@/lib/economy";
import { editionLabel } from "@/lib/dates";

function Article({ id, n, title, children }: { id?: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 border-t-2 border-ink pt-4">
      <h2 className="font-display text-2xl font-black">
        <span className="text-scoop">Artigo {n}.º</span> · {title}
      </h2>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default async function RulesPage() {
  await requireUser();
  const offices = await getOffices();
  const president = offices.presidente?.name ?? "cargo vago";
  const treasurer = offices.tesoureiro?.name ?? "cargo vago";
  const t = TREMOCOS;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="text-center">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Documento fundador</p>
        <h1 className="font-display text-4xl font-black sm:text-5xl">Constituição da Associação</h1>
        <p className="mt-2 italic text-muted">
          Nós, os sócios, reunidos à volta de uma mesa com tremoços, decretamos o seguinte.
        </p>
      </header>

      <Article n={1} title="O Jornal">
        <p>O Jornal da Associação sai em <strong>edições mensais</strong>. Qualquer sócio pode escrever, comentar e reagir.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Os posts podem ser guardados como rascunho, publicados logo ou <strong>agendados</strong> para uma data e hora (de Ílhavo).</li>
          <li>Nos comentários vale Markdown e GIFs: cola o link numa linha sozinha.</li>
          <li>Cada post mostra quem já o leu («visto por») e quem ainda não. Não há onde te esconder.</li>
        </ul>
      </Article>

      <Article id="escala" n={2} title="A Escala de Escrita">
        <p>Há uma escala semanal: na tua semana, de <strong>segunda a domingo às 23:59</strong>, tens de publicar pelo menos um post.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Cumprir a semana vale <strong>+{t.rotaDone} 🫘</strong>.</li>
          <li>Falhar vale o carimbo <strong>EM FALTA</strong> e uma multa automática de <strong>−{t.rotaMissedFine} 🫘</strong>.</li>
          <li>O Presidente pode <strong>indultar</strong> uma falta: o carimbo passa a 🕊️ e a multa é perdoada.</li>
        </ul>
      </Article>

      <Article id="cargos" n={3} title="Os Cargos">
        <p>A Associação tem dois cargos, e só dois.</p>
        <div className="border-2 border-ink bg-white p-3">
          <p className="font-display text-xl font-black">👑 Presidente: {president}</p>
          <ul className="mt-1 list-disc space-y-1 pl-6 text-sm">
            <li>Publica <Link href="/decretos" className="underline hover:text-scoop">Decretos Presidenciais</Link>, numerados por ano. O mais recente fica em destaque na primeira página durante 14 dias.</li>
            <li>Pode revogar os seus decretos.</li>
            <li>Pode indultar faltas na escala.</li>
          </ul>
        </div>
        <div className="border-2 border-ink bg-white p-3">
          <p className="font-display text-xl font-black">💰 Tesoureiro: {treasurer}</p>
          <ul className="mt-1 list-disc space-y-1 pl-6 text-sm">
            <li>Gere o <Link href="/cofre" className="underline hover:text-scoop">Cofre</Link>.</li>
            <li>Aplica <strong>multas</strong> e atribui <strong>subsídios</strong> no valor que entender, sempre com motivo, que fica público no livro.</li>
            <li>Pode movimentar o Cofre a seu favor. Conflitos de interesses não existem; existe confiança institucional. Os sócios lesados podem queixar-se no jantar seguinte.</li>
          </ul>
        </div>
        <p className="text-sm text-muted">
          Os cargos aparecem junto ao nome (👑 e 💰). A manutenção do site está a cargo do Departamento Técnico, que não governa coisa nenhuma.
        </p>
      </Article>

      <Article id="tremoco" n={4} title="O Tremoço 🫘">
        <p>A moeda oficial da Associação é o <strong>Tremoço</strong>. Não vale dinheiro, mas vale honra.</p>
        <table className="w-full border-2 border-ink bg-white text-left text-sm">
          <tbody className="divide-y divide-rule">
            <tr><td className="p-2">Publicar um post</td><td className="p-2 text-right font-bold">+{t.post}</td></tr>
            <tr><td className="p-2">Comentar</td><td className="p-2 text-right font-bold">+{t.comment}</td></tr>
            <tr><td className="p-2">Receber um 😂 de outro sócio</td><td className="p-2 text-right font-bold">+{t.laugh}</td></tr>
            <tr><td className="p-2">Cumprir a semana da escala</td><td className="p-2 text-right font-bold">+{t.rotaDone}</td></tr>
            <tr><td className="p-2">Cota mensal (desde {editionLabel(ECONOMY_START.slice(0, 7)).toLowerCase()})</td><td className="p-2 text-right font-bold text-scoop">−{t.monthlyFee}</td></tr>
            <tr><td className="p-2">Falhar a semana da escala</td><td className="p-2 text-right font-bold text-scoop">−{t.rotaMissedFine}</td></tr>
            <tr><td className="p-2">Multas e subsídios do Tesoureiro</td><td className="p-2 text-right font-bold">± à discrição</td></tr>
          </tbody>
        </table>
        <ul className="list-disc space-y-1 pl-6">
          <li>As cotas e as multas entram no <strong>Cofre da Associação</strong>; os subsídios saem de lá.</li>
          <li>Apagar um post ou um comentário devolve os tremoços que valeu. Não há almoços grátis.</li>
          <li>Quem descer abaixo de <strong>{t.freezeBelow} 🫘</strong> fica com a conta <strong>congelada 🧊</strong>: só pode reagir com 🧂 até pôr as contas em dia.</li>
        </ul>
      </Article>

      <Article n={5} title="Honra e Vergonha">
        <p>O <Link href="/quadro" className="underline hover:text-scoop">Quadro de Honra</Link> e o Mural da Vergonha são atualizados automaticamente. Não há júri, não há recurso e não há misericórdia.</p>
      </Article>

      <Article id="festas" n={6} title="As Épocas Festivas">
        <p>O jornal muda sozinho nas épocas festivas. Tudo começa e acaba automaticamente, em hora de Ílhavo.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>🎄 Natal (1 a 26 de dezembro):</strong> sorteio do <Link href="/natal" className="underline hover:text-scoop">Amigo Secreto</Link>, com postais anónimos e revelação na consoada (24 de dezembro, 20h00). Calendário do Advento com uma porta por dia (algumas dão +{t.adventPrize} 🫘). A 15 de dezembro, subsídio de Natal de +{t.xmasBonus} 🫘 para todos, pago pelo Cofre.
          </li>
          <li>
            <strong>🥂 Ano Novo (27 de dezembro a 6 de janeiro):</strong> o ano em revista e as <Link href="/resolucoes" className="underline hover:text-scoop">resoluções</Link>, seladas até 1 de dezembro do ano seguinte, quando os outros votam se as cumpriste.
          </li>
          <li>
            <strong>🎭 Carnaval (sábado gordo a terça de Carnaval):</strong> toda a gente aparece no jornal com o nome de outro sócio, e os disfarces mudam todos os dias. Na Quarta-feira de Cinzas caem as <Link href="/carnaval" className="underline hover:text-scoop">máscaras</Link>.
          </li>
          <li>
            <strong>🐰 Páscoa (Sexta-feira Santa a Segunda-feira de Páscoa):</strong> caça aos <Link href="/pascoa" className="underline hover:text-scoop">ovos</Link> escondidos pelo jornal (+{t.egg} 🫘 cada) e folar de +{t.folar} 🫘 no Domingo de Páscoa, entregue por um padrinho sorteado e pago pelo Cofre. Quem apanhar mais ovos é o Coelho do Ano.
          </li>
          <li>Cada época traz uma reação própria (🎄, 🥂, 🎭 🥳, 🐣), que só se pode usar durante a festa.</li>
        </ul>
      </Article>

      <Article n={7} title="Disposições finais">
        <ul className="list-disc space-y-1 pl-6">
          <li>Tudo isto é para rir. Quem levar a mal paga a próxima rodada.</li>
          <li>Os conflitos institucionais resolvem-se no jantar seguinte.</li>
          <li>Eleições e moções de censura serão reguladas numa futura revisão constitucional.</li>
          <li>Erros e sugestões: botão «Reportar erro / sugestão» no fundo de cada página.</li>
        </ul>
      </Article>
    </div>
  );
}
