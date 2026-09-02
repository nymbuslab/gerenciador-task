"use client";

import { Check, Clock, TriangleAlert } from "lucide-react";

import type { Papel } from "@/src/components/navigation";

import type { Comando } from "../domain";
import type { TarefaEmLista } from "../task-service";

/**
 * Cartao e linha de tarefa.
 *
 * O estado nunca aparece so por cor: cada situacao tem rotulo escrito, porque
 * quem trabalha no salao olha a tela de relance, no claro, e as vezes nao
 * distingue matiz.
 */

const ROTULO_DO_ESTADO: Record<TarefaEmLista["estado"], string> = {
  pendente: "A fazer",
  em_execucao: "Em andamento",
  bloqueada: "Bloqueada",
  aguardando_validacao: "Aguardando validação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const TOM_DO_ESTADO: Record<TarefaEmLista["estado"], string> = {
  pendente: "neutro",
  em_execucao: "andamento",
  bloqueada: "atencao",
  aguardando_validacao: "validacao",
  concluida: "neutro",
  cancelada: "neutro",
};

export type AcaoDeTarefa = { comando: Comando; rotulo: string; pedeMotivo?: boolean };

const ACOES_DO_EXECUTOR: Record<TarefaEmLista["estado"], AcaoDeTarefa[]> = {
  pendente: [{ comando: "iniciar", rotulo: "Iniciar" }],
  em_execucao: [
    { comando: "concluir", rotulo: "Concluir" },
    { comando: "bloquear", rotulo: "Bloquear", pedeMotivo: true },
  ],
  bloqueada: [{ comando: "retomar", rotulo: "Retomar" }],
  aguardando_validacao: [],
  concluida: [],
  cancelada: [],
};

const ACOES_DA_VALIDACAO: AcaoDeTarefa[] = [
  { comando: "aprovar", rotulo: "Aprovar" },
  { comando: "reprovar", rotulo: "Reprovar", pedeMotivo: true },
];

export function acoesDisponiveis(tarefa: TarefaEmLista, papel: Papel): AcaoDeTarefa[] {
  if (tarefa.estado === "aguardando_validacao") {
    return papel === "funcionario" ? [] : ACOES_DA_VALIDACAO;
  }

  return ACOES_DO_EXECUTOR[tarefa.estado];
}

export function formatarDuracao(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);

  if (horas > 0) {
    return `${horas}h ${String(minutos % 60).padStart(2, "0")}min`;
  }

  return `${minutos}min`;
}

export function formatarHora(instante: string | null): string {
  if (!instante) {
    return "--:--";
  }

  return new Date(instante).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SeloDeEstado({ estado }: { estado: TarefaEmLista["estado"] }) {
  return (
    <span className="selo" data-tom={TOM_DO_ESTADO[estado]}>
      {ROTULO_DO_ESTADO[estado]}
    </span>
  );
}

/**
 * O botao mostra so o verbo. O titulo da tarefa vai no nome acessivel, porque
 * repeti-lo na face transforma a acao num paragrafo e quebra a linha da lista.
 */
function Acoes({
  tarefa,
  papel,
  ocupada,
  aoComandar,
  discreto,
}: {
  tarefa: TarefaEmLista;
  papel: Papel;
  ocupada?: boolean;
  aoComandar: (tarefa: TarefaEmLista, acao: AcaoDeTarefa) => void;
  /** Fora do cartao em foco nenhuma acao e preenchida: so o agora recebe peso. */
  discreto?: boolean;
}) {
  const acoes = acoesDisponiveis(tarefa, papel);

  if (acoes.length === 0) {
    return null;
  }

  return (
    <>
      {acoes.map((acao, posicao) => (
        <button
          key={acao.comando}
          className={posicao === 0 && !discreto ? "botao" : "botao botao--discreto"}
          type="button"
          disabled={ocupada}
          aria-label={`${acao.rotulo} ${tarefa.titulo}`}
          onClick={() => aoComandar(tarefa, acao)}
        >
          {acao.rotulo}
        </button>
      ))}
    </>
  );
}

/**
 * A tarefa da vez. Rompe a regua de tempo e recebe o unico botao preenchido da
 * tela, porque e a proxima acao de quem esta com o aparelho na mao.
 */
export function TarefaEmFoco({
  tarefa,
  papel,
  ocupada,
  aoComandar,
}: {
  tarefa: TarefaEmLista;
  papel: Papel;
  ocupada?: boolean;
  aoComandar: (tarefa: TarefaEmLista, acao: AcaoDeTarefa) => void;
}) {
  return (
    <article className="tarefa" aria-labelledby={`tarefa-${tarefa.execucaoId}`}>
      <div className="regua">
        <span className="regua__hora">{formatarHora(tarefa.iniciadaEm)}</span>
        <span className="regua__marca" />
        <span className="regua__fio" />
        <span className="regua__hora regua__hora--fim">{formatarHora(tarefa.prazo)}</span>
      </div>

      <div className="tarefa__corpo">
        <h3 className="tarefa__titulo" id={`tarefa-${tarefa.execucaoId}`}>
          {tarefa.titulo}
        </h3>

        {tarefa.instrucoes && <p className="tarefa__instrucoes">{tarefa.instrucoes}</p>}

        <div className="tarefa__meta">
          <SeloDeEstado estado={tarefa.estado} />

          <span className="medida">
            <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
            {formatarDuracao(tarefa.segundosAtivos)} ativos
          </span>

          {tarefa.prioridade === "alta" && (
            <span className="selo" data-tom="atencao">
              Prioridade alta
            </span>
          )}

          {tarefa.exigeAprovacao && <span className="selo">Validação do líder</span>}
        </div>

        <div className="tarefa__acoes">
          <Acoes tarefa={tarefa} papel={papel} ocupada={ocupada} aoComandar={aoComandar} />
        </div>
      </div>
    </article>
  );
}

/**
 * Linha compacta: o que vem depois e o que ja foi feito. Mantem o horario na
 * mesma coluna do cartao em foco, para a regua continuar de cima a baixo.
 */
export function LinhaDeTarefa({
  tarefa,
  papel,
  ocupada,
  aoComandar,
  feita,
}: {
  tarefa: TarefaEmLista;
  papel: Papel;
  ocupada?: boolean;
  aoComandar: (tarefa: TarefaEmLista, acao: AcaoDeTarefa) => void;
  feita?: boolean;
}) {
  return (
    <article
      className={feita ? "linha linha--feita" : "linha"}
      aria-labelledby={`tarefa-${tarefa.execucaoId}`}
    >
      {feita ? (
        <span className="linha__icone">
          <Check size={18} strokeWidth={1.5} aria-hidden="true" />
        </span>
      ) : (
        <span className="linha__hora">{formatarHora(tarefa.prazo)}</span>
      )}

      <span className="linha__titulo" id={`tarefa-${tarefa.execucaoId}`}>
        {tarefa.titulo}
      </span>

      {tarefa.estado === "bloqueada" && (
        <span className="selo" data-tom="atencao">
          <TriangleAlert size={12} strokeWidth={1.5} aria-hidden="true" /> Bloqueada
        </span>
      )}

      {tarefa.prioridade === "alta" && !feita && (
        <span className="selo" data-tom="atencao">
          Alta
        </span>
      )}

      {tarefa.estado === "aguardando_validacao" && <SeloDeEstado estado={tarefa.estado} />}

      <span className="linha__acoes">
        <Acoes
          tarefa={tarefa}
          papel={papel}
          ocupada={ocupada}
          aoComandar={aoComandar}
          discreto
        />
      </span>
    </article>
  );
}
