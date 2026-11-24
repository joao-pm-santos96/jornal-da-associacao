import { GRAOS } from "@/lib/economy";

const TITLE = { presidente: "Presidente", tesoureiro: "Tesoureiro" } as const;

export function LetterBody({ office }: { office: keyof typeof TITLE }) {
  const title = TITLE[office];
  return (
    <>
      <p>Caro {title},</p>
      <p>
        Parabéns pelo cargo. Há uma coisa que não vem na Constituição e que só o {title} fica a saber: as{" "}
        <strong>despesas de representação</strong>.
      </p>
      <p>
        Uma vez por semana podes justificar uma despesa de até {GRAOS.slushPct}% do que estiver disponível no Cofre. Escolhes a desculpa,
        e os grãos vão para uma conta só tua, o <strong>saco azul</strong>, que mais ninguém vê. No livro do Cofre fica a despesa e a
        justificação, mas não o teu nome.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Lavagem:</strong> até {GRAOS.slushWashCap} ☕ por semana passam do saco para a tua carteira, como «Consultoria».
        </li>
        <li>
          <strong>Prescrição:</strong> ao fim de {GRAOS.slushPrescribeWeeks} semanas, o que sobrar passa sozinho, limpinho.
        </li>
        <li>
          <strong>Risco:</strong> qualquer sócio pode pagar uma auditoria às contas. Quanto mais cheio o saco, mais fácil é seres
          apanhado ({GRAOS.auditBasePct}% mais {GRAOS.auditPerGrainPct}% por grão, até {GRAOS.auditMaxPct}%). Se fores, o saco volta ao
          Cofre, pagas metade dele de multa e o escândalo sai na primeira página.
        </li>
      </ul>
      <p>
        O formulário está aqui no teu gabinete, logo abaixo. O saco vê-se em «Ver o teu saco azul».
      </p>
      <p>
        Esta carta passa de {title} para {title}. Não a comentes com ninguém: um privilégio partilhado deixa de ser privilégio.
      </p>
      <p className="text-right italic">O teu antecessor</p>
    </>
  );
}
