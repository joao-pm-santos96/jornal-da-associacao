import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOffices } from "@/lib/offices";
import { getRules, scratchPrizes, slotBets, slotPaytable } from "@/lib/rules";
import { getComedySchedule, onDay } from "@/lib/comedy";
import { scratchReturn, scratchWinChance } from "@/lib/scratch-table";
import { expectedReturn } from "@/lib/slot-table";
import { grains } from "@/lib/grains";

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
  const bookie = offices.apostas?.name ?? "cargo vago";
  const t = await getRules();
  const comedy = await getComedySchedule();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="text-center">
        <p className="text-xs font-black uppercase tracking-widest text-scoop">Documento fundador</p>
        <h1 className="font-display text-4xl font-black sm:text-5xl">Constituição da Associação</h1>
        <p className="mt-2 italic text-muted">
          Nós, os sócios, reunidos à volta de uma mesa de café, decretamos o seguinte.
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
          <li>Cumprir a semana vale <strong>+{t.rotaDone} ☕</strong>.</li>
          <li>Falhar vale o carimbo <strong>EM FALTA</strong> e uma multa automática de <strong>−{t.rotaMissedFine} ☕</strong>.</li>
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
            <li>Aplica <strong>multas</strong> e atribui <strong>subsídios</strong>, sempre com motivo, que fica público no livro. Os subsídios só saem até ao saldo disponível do Cofre.</li>
            <li>Para se pagar a si próprio precisa do aval do Presidente. Conflitos de interesses existem; agora há quem os vigie.</li>
          </ul>
        </div>
        <p className="text-sm text-muted">
          Os cargos aparecem junto ao nome (👑 e 💰). A manutenção do site está a cargo do Departamento Técnico, que não governa coisa nenhuma.
        </p>
      </Article>

      <Article id="cafe" n={4} title="O Grão de Café ☕">
        <p>A moeda oficial da Associação é o <strong>Grão de Café</strong>. Não vale dinheiro, mas vale honra (e cafeína).</p>
        <p>
          A economia é <strong>fechada</strong>: o número de grãos não muda. Cada grão está na carteira de um sócio ou no{" "}
          <Link href="/cofre" className="underline hover:text-scoop">Cofre</Link>, e nenhum aparece do nada. Tudo fica escrito num só livro, que não se apaga:
          um erro corrige-se com um estorno.
        </p>
        <p>
          Os valores desta secção são os que estão em vigor. Preços, taxas, multas, pontos e percentagens são decididos pelo{" "}
          <strong>Tesoureiro</strong>, por despacho publicado em <Link href="/decretos" className="underline hover:text-scoop">/decretos</Link>, e mudam
          logo. Só o total de grãos em circulação é intocável. A tabela completa está em{" "}
          <Link href="/cofre/tabela" className="underline hover:text-scoop">Preços e taxas</Link>.
        </p>
        <h3 className="font-bold">O ordenado semanal</h3>
        <p>
          Todas as segundas-feiras de manhã o Cofre distribui <strong>{t.payrollPct}% do seu saldo disponível</strong> pelos pontos que cada sócio fez na
          semana anterior (de segunda a domingo, hora de Ílhavo). Com o Cofre cheio cada ponto vale mais; com o Cofre vazio vale menos.
        </p>
        <table className="w-full border-2 border-ink bg-white text-left text-sm">
          <tbody className="divide-y divide-rule">
            <tr><td className="p-2">Publicar um post</td><td className="p-2 text-right font-bold">{t.post} pontos</td></tr>
            <tr><td className="p-2">Comentar (até {t.commentCap} por semana)</td><td className="p-2 text-right font-bold">{t.comment} {t.comment === 1 ? "ponto" : "pontos"}</td></tr>
            <tr><td className="p-2">Receber um 😂 de outro sócio (um por sócio por dia, até {t.laughCap} por semana)</td><td className="p-2 text-right font-bold">{t.laugh} {t.laugh === 1 ? "ponto" : "pontos"}</td></tr>
            <tr><td className="p-2">Cumprir a semana da escala</td><td className="p-2 text-right font-bold">+{t.rotaDone} pontos</td></tr>
            <tr><td className="p-2">Falhar a semana da escala</td><td className="p-2 text-right font-bold text-scoop">0 pontos e −{t.rotaMissedFine} ☕</td></tr>
            <tr><td className="p-2">Cota semanal, cobrada à segunda-feira</td><td className="p-2 text-right font-bold text-scoop">−{t.weeklyFee} ☕</td></tr>
          </tbody>
        </table>
        <ul className="list-disc space-y-1 pl-6">
          <li>O ordenado é em grãos inteiros. As sobras vão, uma a uma, para quem ficou com o maior resto (empate: mais pontos, depois sorteio).</li>
          <li>Um post apagado antes de segunda-feira não conta; apagado depois de pago, devolve o que rendeu.</li>
          <li>As cotas, as multas, a margem do Casino e as compras na loja entram no Cofre. O ordenado, os subsídios e os bónus das festas saem de lá. O Cofre nunca paga o que não tem.</li>
        </ul>
        <h3 className="font-bold">Dívidas</h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>Quem não tem saldo para a cota ou uma multa fica a dever ao Cofre. O ordenado paga a dívida primeiro.</li>
          <li>Quem está em dívida não aposta, não dá gorjetas nem grãos, não compra na loja nem encomenda posts.</li>
          <li>A dívida deixa de crescer aos <strong>{grains(t.debtFloor)} ☕</strong>, quando a conta fica <strong>congelada 🧊</strong>: só se pode reagir com 🧂.</li>
          <li>O Presidente pode decretar amnistias. Não custam nada ao Cofre, porque esses grãos nunca lá entraram.</li>
        </ul>
        <h3 className="font-bold">Para que serve o grão</h3>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Gorjetas:</strong> «pagar um café» a um post ou comentário de que gostaste, com {t.tipVatPct}% de IVA para o Cofre.</li>
          <li><strong>Ofertas:</strong> dar grãos a outro sócio, no Cofre, com um motivo à escolha. Não há IVA nem taxas, e fica nos extratos dos dois.</li>
          <li><strong>Encomendas:</strong> oferecer grãos a quem escrever sobre um tema. Ficam retidos até alguém entregar; se ninguém pegar até ao prazo, voltam.</li>
          <li><strong>Loja do Cofre:</strong> destacar um post na primeira página durante {t.highlightHours} h ({t.highlight} ☕), indulto da escala ({t.pardon} ☕, na tua semana, antes de publicares) e alcunha durante {t.nicknameDays} dias ({t.nickname} ☕).</li>
          <li>E o <Link href="/casino" className="underline hover:text-scoop">Casino</Link>, claro.</li>
        </ul>
        <p className="text-sm text-muted">Novos sócios começam a zero e recebem um kit de boas-vindas de {t.welcomeKit} ☕, pago pelo Cofre.</p>
      </Article>

      <Article n={5} title="Honra e Vergonha">
        <p>O <Link href="/quadro" className="underline hover:text-scoop">Quadro de Honra</Link>, o Mural da Vergonha e o Quadro da Cobardia são atualizados automaticamente. Não há júri, não há recurso e não há misericórdia.</p>
      </Article>

      <Article id="festas" n={6} title="As Épocas Festivas">
        <p>O jornal muda sozinho nas épocas festivas. Tudo começa e acaba automaticamente, em hora de Ílhavo.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>🎄 Natal (1 a 26 de dezembro):</strong> sorteio do <Link href="/natal" className="underline hover:text-scoop">Amigo Secreto</Link>, com postais anónimos e revelação na consoada (24 de dezembro, 20h00). Calendário do Advento com uma porta por dia (algumas dão +{t.adventPrize} ☕). A 15 de dezembro, subsídio de Natal: o Cofre reparte {t.xmasPct}% do disponível por todos, em partes iguais. Os grãos do Advento só saem enquanto o Cofre tiver fundos.
          </li>
          <li>
            <strong>🥂 Ano Novo (27 de dezembro a 6 de janeiro):</strong> o ano em revista e as <Link href="/resolucoes" className="underline hover:text-scoop">resoluções</Link>, seladas até 1 de dezembro do ano seguinte, quando os outros votam se as cumpriste.
          </li>
          <li>
            <strong>🎭 Carnaval (sábado gordo a terça de Carnaval):</strong> toda a gente aparece no jornal com o nome de outro sócio, e os disfarces mudam todos os dias. Na Quarta-feira de Cinzas caem as <Link href="/carnaval" className="underline hover:text-scoop">máscaras</Link>.
          </li>
          <li>
            <strong>🐰 Páscoa (Sexta-feira Santa a Segunda-feira de Páscoa):</strong> caça aos <Link href="/pascoa" className="underline hover:text-scoop">ovos</Link> escondidos pelo jornal (+{t.egg} ☕ cada, enquanto o Cofre tiver fundos) e folar no Domingo de Páscoa: {t.folarPct}% do disponível no Cofre, repartido por todos e entregue por um padrinho sorteado. Quem apanhar mais ovos é o Coelho do Ano.
          </li>
          <li>Cada época traz uma reação própria (🎄, 🥂, 🎭 🥳, 🐣), que só se pode usar durante a festa.</li>
        </ul>
      </Article>

      <Article id="casino" n={7} title="O Casino 🎰">
        <p>No <Link href="/casino" className="underline hover:text-scoop">Casino da Associação</Link> aposta-se em grãos de café, com <strong>apostas mútuas</strong>: o pote é de quem acerta.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Só o <strong>Gestor de Apostas 🎲</strong> ({bookie}) pode abrir apostas, e abrir uma aposta é grátis. Quem quiser uma aposta pede-lha.</li>
          <li>Quem abre a aposta fica com a <strong>banca</strong>: decide quando fecha, declara o resultado e pode anulá-la. Não pode apostar na sua própria aposta. A palavra da banca é final.</li>
          <li>Cada aposta tem entre 2 e 6 opções e uma hora de fecho. Até lá, qualquer sócio pode apostar as vezes que quiser.</li>
          <li>Os grãos apostados saem logo do saldo. Só aposta quem tem saldo positivo, e no máximo o que tem.</li>
          <li>Ao resolver, <strong>{t.betHouseCutPct}% do pote fica no Cofre</strong>. O resto é dividido pelos vencedores na proporção do que cada um apostou (os arredondamentos também ficam no Cofre).</li>
          <li>Se ninguém acertar, o pote inteiro fica no Cofre. A casa agradece.</li>
          <li>Se a aposta for anulada, os grãos apostados voltam todos a quem apostou.</li>
          <li>Com {t.betBankerMinBettors} ou mais apostadores, a banca recebe uma comissão de até {t.betBankerFee} ☕, tirada da parte da casa.</li>
          <li>Enquanto a aposta está aberta só se vêem os totais por opção. Quem apostou em quê revela-se quando fecha.</li>
          <li>Em caso de batota flagrante, o admin pode fechar, resolver ou anular qualquer aposta.</li>
          <li>A <Link href="/casino/slot" className="underline hover:text-scoop">slot machine</Link> aceita jogadas de {slotBets(t).join(", ").replace(/, (\d+)$/, " ou $1")} ☕. Paga até ×{Math.max(...slotPaytable(t).map((s) => s.triple))}, com multiplicadores e probabilidades decididos pelo Tesoureiro, e devolve em média {Math.round(expectedReturn(slotPaytable(t)) * 100)}% do que recebe. A diferença é do Cofre.</li>
          <li>A <Link href="/casino/raspadinha" className="underline hover:text-scoop">Raspadinha</Link> custa {t.scratchCost} ☕ por bilhete; três símbolos iguais ganham. Sai prémio em {Math.round(scratchWinChance(scratchPrizes(t)) * 100)}% dos bilhetes e, em média, devolve {Math.round(scratchReturn(scratchPrizes(t)) * 100)}% do que custa.</li>
          <li>No <Link href="/casino/alto-baixo" className="underline hover:text-scoop">Alto ou Baixo</Link> aposta-se entre {t.hiloMinBet} e {t.hiloMaxBet} ☕ e adivinha-se se a próxima carta é mais alta ou mais baixa. Cada acerto multiplica a aposta conforme a probabilidade, menos {t.hiloEdgePct}% para a casa; uma carta igual não conta e segue para a próxima. Pode-se recolher depois do primeiro acerto, e aos ×{t.hiloMaxMult} recolhe-se sozinho.</li>
          <li>A <Link href="/casino/patos" className="underline hover:text-scoop">Corrida de Patos</Link> é todos os domingos às 21h. As apostas são mútuas, a casa fica com {t.raceHouseCutPct}% e o vencedor é sorteado: todos os patos têm as mesmas hipóteses.</li>
          <li>Nos <Link href="/casino/duelos" className="underline hover:text-scoop">Duelos</Link> desafia-se outro sócio para pedra, papel ou tesoura. Quem ganha leva o pote menos {t.duelHouseCutPct}%; em caso de empate, cada um fica com o seu. O mínimo é {t.duelMinStake} ☕ e um desafio sem resposta em {t.duelExpiryHours}h expira e os grãos voltam.</li>
          <li>
            No <Link href="/casino/bilhar" className="underline hover:text-scoop">Bilhar</Link> joga-se 8 bolas contra outro sócio, por turnos. Quem desafia abre. A mesa fica aberta até alguém meter uma bola sem falta: fica com esse grupo (lisas ou riscadas) e o outro fica com o resto. Quem mete uma bola sua continua a jogar.
            São falta meter a branca, não tocar em nenhuma bola e tocar primeiro numa bola que não é tua; depois de uma falta, o adversário joga com a branca na mão. Ganha quem meter a preta depois de limpar as suas bolas; quem a meter antes de tempo, ou com falta, perde. A preta que entra na abertura volta à mesa.
            {t.poolMinStake > 0 ? `A aposta mínima é de ${t.poolMinStake} ☕` : "A aposta é opcional"} e quem ganha leva o pote menos {t.poolHouseCutPct}%. Um desafio sem resposta em {t.poolAcceptHours}h expira, e quem não jogar a sua vez em {t.poolTurnHours}h perde a partida.
          </li>
          <li>
            No <Link href="/casino/gatilho" className="underline hover:text-scoop">Gatilho</Link> ganha quem tem melhores reflexos. Quem desafia joga primeiro e o outro joga depois, cada um na sua vez: são 3 tentativas em que o ecrã fica vermelho e, ao fim de um tempo aleatório, verde. Conta o tempo até ao toque e ganha a média mais baixa.
            Tocar antes do verde, demorar mais de 1 segundo ou deixar uma tentativa a meio conta como 1 segundo. Os tempos do adversário só se vêem no fim; em caso de empate, cada um fica com o seu.
            {t.reflexMinStake > 0 ? ` A aposta mínima é de ${t.reflexMinStake} ☕` : " A aposta é opcional"} e quem ganha leva o pote menos {t.reflexHouseCutPct}%. Um desafio sem resposta em {t.reflexAcceptHours}h expira, e quem não jogar a sua vez em {t.reflexTurnHours}h perde.
          </li>
        </ul>
      </Article>

      <Article id="assembleia" n={8} title="A Assembleia 🗳️">
        <p>A <Link href="/assembleia" className="underline hover:text-scoop">Assembleia</Link> é o órgão soberano da Associação. Decide-se lá qualquer coisa, do sítio do jantar a mudanças à Constituição.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Qualquer sócio pode convocar uma votação, com uma de cada vez em aberto. Escolhe o formato (<strong>Sim / Não / Abstenção</strong> ou <strong>escolha entre 2 a 6 opções</strong>) e a duração, de 2 horas a 7 dias.</li>
          <li>Todos os sócios votam, incluindo os que têm a conta congelada. Pode-se mudar o voto até fechar. Se todos votarem antes do prazo, a votação fecha mais cedo.</li>
          <li>Não há quórum: decide a <strong>maioria de quem votou</strong>. As abstenções não contam para a maioria. Mudar a Constituição precisa de <strong>2/3</strong> dos votos sim ou não.</li>
          <li>Em caso de empate, vale o <strong>voto de qualidade do Presidente</strong>, se tiver votado numa das opções empatadas. Se não, nada fica decidido.</li>
          <li>No <strong>voto secreto</strong> só se conhecem os totais, quando a votação fecha; enquanto está aberta, só se sabe quem já votou. No <strong>voto nominal</strong>, quem votou em quê vê-se em tempo real, incluindo quem muda de voto.</li>
          <li>Uma votação pode ser <strong>consultiva</strong> (só opinião) ou <strong>vinculativa</strong>. As vinculativas aprovadas ficam na primeira página como «Por cumprir» até o Presidente ou o Tesoureiro as marcarem como cumpridas.</li>
          <li>Cada votação tem o seu debate, e cada votação fechada fica arquivada como ata. Quem convoca pode anular a sua votação enquanto está aberta.</li>
        </ul>
      </Article>

      <Article id="comedy" n={9} title="O Comedy Club 🎤">
        <p>No <Link href="/comedy-club" className="underline hover:text-scoop">Comedy Club</Link> escolhe-se, todas as semanas, a melhor piada da Associação. Participar e votar é opcional e de borla.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Cada sócio entrega no máximo <strong>uma piada por semana</strong>. Até abrir a votação pode mudá-la ou retirá-la, e ninguém a vê.</li>
          <li>A votação é <strong>{onDay(comedy.day)}, das {comedy.opens}h às {comedy.closes}h</strong>, num dia e horário decididos pelo Presidente. As piadas aparecem sem nome; cada sócio vota numa (na sua não pode) e pode mudar o voto até fechar.</li>
          <li>Ganha a piada mais votada; em caso de empate, a que foi entregue primeiro. Se ninguém votar, não há vencedor.</li>
          <li>O vencedor recebe <strong>{t.comedyPrize} ☕</strong> do Cofre (ou o que houver disponível) e o título de <strong>palhaço da semana 🤡</strong>, que aparece junto ao nome durante uma semana.</li>
          <li>Piadas entregues depois de a votação fechar contam para a semana seguinte.</li>
        </ul>
      </Article>

      <Article n={10} title="Disposições finais">
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
