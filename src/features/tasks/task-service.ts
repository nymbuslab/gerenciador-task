import type { SupabaseClient } from "@supabase/supabase-js";

import { pendenciasDeConclusao } from "../execution/evidence-service";
import {
  aplicarComando,
  execucaoInicial,
  type Comando,
  type Execucao,
} from "./domain";

/**
 * Ponte entre a maquina de estados e o banco.
 *
 * O servico nao decide transicao: ele carrega a execucao, entrega ao dominio e
 * grava o resultado. A escrita passa por `aplicar_transicao_tarefa`, que aplica
 * a mudanca e a auditoria na mesma transacao e recusa versao divergente.
 */

const CODIGO_CONFLITO = "P0002";
const CODIGO_RECUSA = "42501";

const TEXTO_DA_PENDENCIA: Record<string, string> = {
  checklist: "ainda há item obrigatório do checklist sem marcar",
  fotos: "faltam fotos exigidas por esta tarefa",
  observacao: "esta tarefa exige uma observação antes de concluir",
};

export type ExecucaoPersistida = Execucao & {
  id: string;
  version: number;
  ocorrenciaId: string;
  exigeAprovacao: boolean;
};

export type ResultadoComando =
  | { situacao: "ok"; execucao: ExecucaoPersistida }
  | { situacao: "recusado"; motivo: string }
  | { situacao: "conflito"; motivo: string }
  | { situacao: "indisponivel"; motivo: string };

type LinhaExecucao = {
  id: string;
  occurrence_id: string;
  version: number;
  estado: Execucao["estado"];
  iniciada_em: string | null;
  faixa_ativa_desde: string | null;
  bloqueada_em: string | null;
  bloqueio_motivo: string | null;
  segundos_ativos: number;
  segundos_bloqueados: number;
  validacao_solicitada_em: string | null;
  reprovacao_motivo: string | null;
  concluida_em: string | null;
  cancelada_em: string | null;
  task_occurrences: { exige_aprovacao: boolean } | { exige_aprovacao: boolean }[] | null;
};

const CAMPOS =
  "id, occurrence_id, version, estado, iniciada_em, faixa_ativa_desde, bloqueada_em," +
  " bloqueio_motivo, segundos_ativos, segundos_bloqueados, validacao_solicitada_em," +
  " reprovacao_motivo, concluida_em, cancelada_em, task_occurrences!inner(exige_aprovacao)";

// O Postgres devolve "+00:00" e o dominio compara instantes em ISO com Z.
// Normalizar na fronteira evita comparar duas grafias do mesmo momento.
function instante(valor: string | null): string | null {
  return valor ? new Date(valor).toISOString() : null;
}

function paraDominio(linha: LinhaExecucao): ExecucaoPersistida {
  const ocorrencia = Array.isArray(linha.task_occurrences)
    ? linha.task_occurrences[0]
    : linha.task_occurrences;

  return {
    ...execucaoInicial(),
    id: linha.id,
    version: linha.version,
    ocorrenciaId: linha.occurrence_id,
    exigeAprovacao: ocorrencia?.exige_aprovacao ?? false,
    estado: linha.estado,
    iniciadaEm: instante(linha.iniciada_em),
    faixaAtivaDesde: instante(linha.faixa_ativa_desde),
    bloqueadaEm: instante(linha.bloqueada_em),
    bloqueioMotivo: linha.bloqueio_motivo,
    segundosAtivos: linha.segundos_ativos,
    segundosBloqueados: linha.segundos_bloqueados,
    validacaoSolicitadaEm: instante(linha.validacao_solicitada_em),
    reprovacaoMotivo: linha.reprovacao_motivo,
    concluidaEm: instante(linha.concluida_em),
    canceladaEm: instante(linha.cancelada_em),
  };
}

export async function carregarExecucao(
  cliente: SupabaseClient,
  execucaoId: string,
): Promise<ExecucaoPersistida | null> {
  const { data, error } = await cliente
    .from("task_executions")
    .select(CAMPOS)
    .eq("id", execucaoId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return paraDominio(data as unknown as LinhaExecucao);
}

export async function executarComando(
  cliente: SupabaseClient,
  entrada: { execucaoId: string; comando: Comando; motivo?: string },
  agora: Date = new Date(),
): Promise<ResultadoComando> {
  const atual = await carregarExecucao(cliente, entrada.execucaoId);

  if (!atual) {
    return { situacao: "indisponivel", motivo: "execução fora do alcance desta sessão" };
  }

  const transicao = aplicarComando(atual, entrada.comando, agora, {
    motivo: entrada.motivo,
    exigeAprovacao: atual.exigeAprovacao,
  });

  if (transicao.situacao === "recusado") {
    return transicao;
  }

  // Checklist, fotos e observacao sao conferidos antes da escrita: concluir com
  // requisito em aberto deixaria a tarefa marcada como pronta sem a prova que a
  // liderança pediu.
  if (entrada.comando === "concluir") {
    const pendencias = await pendenciasDeConclusao(cliente, atual.id);

    if (pendencias.length > 0) {
      return {
        situacao: "recusado",
        motivo: pendencias
          .map((pendencia) => TEXTO_DA_PENDENCIA[pendencia] ?? pendencia)
          .join("; "),
      };
    }
  }

  const proxima = transicao.execucao;

  const { error } = await cliente.rpc("aplicar_transicao_tarefa", {
    p_execucao: atual.id,
    p_versao_esperada: atual.version,
    p_acao: entrada.comando,
    // O estado nao vai daqui: o banco deriva a transicao da acao e do estado
    // gravado. Estes campos sao os marcos de tempo e o motivo.
    p_campos: {
      iniciada_em: proxima.iniciadaEm,
      faixa_ativa_desde: proxima.faixaAtivaDesde,
      bloqueada_em: proxima.bloqueadaEm,
      bloqueio_motivo: proxima.bloqueioMotivo,
      segundos_ativos: proxima.segundosAtivos,
      segundos_bloqueados: proxima.segundosBloqueados,
      validacao_solicitada_em: proxima.validacaoSolicitadaEm,
      reprovacao_motivo: proxima.reprovacaoMotivo,
      concluida_em: proxima.concluidaEm,
      cancelada_em: proxima.canceladaEm,
    },
  });

  if (error) {
    if (error.code === CODIGO_CONFLITO) {
      return {
        situacao: "conflito",
        motivo: "a execução mudou desde a última leitura; recarregue antes de tentar de novo",
      };
    }

    // O banco recusa por autorizacao ou por transicao invalida, e a mensagem
    // dele ja e escrita para quem esta na tela.
    if (error.code === CODIGO_RECUSA) {
      return { situacao: "recusado", motivo: error.message };
    }

    return { situacao: "indisponivel", motivo: "não foi possível gravar a transição" };
  }

  const persistida = await carregarExecucao(cliente, atual.id);

  if (!persistida) {
    return { situacao: "indisponivel", motivo: "transição gravada, mas a leitura falhou" };
  }

  return { situacao: "ok", execucao: persistida };
}

// ---------------------------------------------------------------------------
// Consultas das telas
//
// As paginas usam somente o que esta aqui: nenhuma tela monta consulta propria
// nem conhece o formato das tabelas.
// ---------------------------------------------------------------------------

export type TarefaEmLista = {
  execucaoId: string;
  ocorrenciaId: string;
  titulo: string;
  instrucoes: string | null;
  prioridade: "baixa" | "normal" | "alta";
  estado: Execucao["estado"];
  prazo: string | null;
  setorId: string | null;
  responsavelPerfilId: string | null;
  responsavelNome: string | null;
  compartilhada: boolean;
  exigeAprovacao: boolean;
  segundosAtivos: number;
  iniciadaEm: string | null;
};

type LinhaLista = {
  id: string;
  occurrence_id: string;
  estado: Execucao["estado"];
  sector_id: string | null;
  responsavel_perfil_id: string | null;
  compartilhada: boolean;
  segundos_ativos: number;
  iniciada_em: string | null;
  task_occurrences:
    | {
        titulo: string;
        instrucoes: string | null;
        prioridade: TarefaEmLista["prioridade"];
        prazo: string | null;
        exige_aprovacao: boolean;
      }
    | null;
  profiles: { nome: string } | { nome: string }[] | null;
};

const CAMPOS_DE_LISTA =
  "id, occurrence_id, estado, sector_id, responsavel_perfil_id, compartilhada," +
  " segundos_ativos, iniciada_em, task_occurrences!inner(titulo, instrucoes, prioridade, prazo, exige_aprovacao)," +
  // task_executions aponta duas vezes para profiles (responsavel e validador).
  // Sem nomear a chave, o PostgREST nao sabe qual seguir e devolve erro.
  " profiles!task_executions_responsavel_perfil_id_fkey(nome)";

/**
 * O dia e uma sequencia, e a regua de tempo promete isso na tela. Ordenar por
 * prazo aqui mantem a promessa; tarefa sem prazo fecha a lista, porque nao
 * disputa horario com quem tem.
 */
function porPrazo(uma: TarefaEmLista, outra: TarefaEmLista): number {
  if (uma.prazo === outra.prazo) {
    return uma.titulo.localeCompare(outra.titulo, "pt-BR");
  }

  if (!uma.prazo) {
    return 1;
  }

  if (!outra.prazo) {
    return -1;
  }

  return new Date(uma.prazo).getTime() - new Date(outra.prazo).getTime();
}

function paraLista(linha: LinhaLista): TarefaEmLista {
  const responsavel = Array.isArray(linha.profiles) ? linha.profiles[0] : linha.profiles;

  return {
    execucaoId: linha.id,
    ocorrenciaId: linha.occurrence_id,
    titulo: linha.task_occurrences?.titulo ?? "",
    instrucoes: linha.task_occurrences?.instrucoes ?? null,
    prioridade: linha.task_occurrences?.prioridade ?? "normal",
    estado: linha.estado,
    prazo: linha.task_occurrences?.prazo ?? null,
    setorId: linha.sector_id,
    responsavelPerfilId: linha.responsavel_perfil_id,
    responsavelNome: responsavel?.nome ?? null,
    compartilhada: linha.compartilhada,
    exigeAprovacao: linha.task_occurrences?.exige_aprovacao ?? false,
    segundosAtivos: linha.segundos_ativos,
    iniciadaEm: linha.iniciada_em,
  };
}

/**
 * A RLS ja limita cada consulta ao que a pessoa pode ver, entao as tres listas
 * abaixo diferem apenas no recorte, e nao na permissao.
 */
export async function listarMinhasTarefas(
  cliente: SupabaseClient,
  perfilId: string,
): Promise<TarefaEmLista[]> {
  const { data } = await cliente
    .from("task_executions")
    .select(CAMPOS_DE_LISTA)
    .or(`responsavel_perfil_id.eq.${perfilId},compartilhada.is.true`);

  return ((data ?? []) as unknown as LinhaLista[]).map(paraLista).sort(porPrazo);
}

export async function listarTarefasDoSetor(
  cliente: SupabaseClient,
  setorId: string,
): Promise<TarefaEmLista[]> {
  const { data } = await cliente
    .from("task_executions")
    .select(CAMPOS_DE_LISTA)
    .eq("sector_id", setorId);

  return ((data ?? []) as unknown as LinhaLista[]).map(paraLista).sort(porPrazo);
}

export async function listarTarefasDaLoja(cliente: SupabaseClient): Promise<TarefaEmLista[]> {
  const { data } = await cliente
    .from("task_executions")
    .select(CAMPOS_DE_LISTA);

  return ((data ?? []) as unknown as LinhaLista[]).map(paraLista).sort(porPrazo);
}

export type NovaTarefa = {
  titulo: string;
  publico: "pessoa" | "setor" | "todos";
  setorId?: string | null;
  modo?: "coletiva" | "individual";
  destinatarios?: string[];
  instrucoes?: string | null;
  prioridade?: TarefaEmLista["prioridade"];
  prazo?: string | null;
  exigeChecklist?: boolean;
  itensChecklist?: string[];
  exigeFoto?: boolean;
  fotosMinimas?: number;
  exigeObservacao?: boolean;
  exigeAprovacao?: boolean;
};

export type ResultadoCriacao =
  | { situacao: "ok"; ocorrenciaId: string; execucoes: number }
  | { situacao: "recusado"; motivo: string };

export async function criarTarefa(
  cliente: SupabaseClient,
  entrada: NovaTarefa,
): Promise<ResultadoCriacao> {
  const titulo = entrada.titulo.trim();

  if (titulo.length < 2) {
    return { situacao: "recusado", motivo: "o título precisa de ao menos dois caracteres" };
  }

  if (entrada.publico !== "todos" && !entrada.setorId) {
    return { situacao: "recusado", motivo: "escolha o setor da tarefa" };
  }

  const { data, error } = await cliente.rpc("criar_tarefa", {
    p_titulo: titulo,
    p_publico: entrada.publico,
    p_setor: entrada.setorId ?? null,
    p_modo: entrada.modo ?? "individual",
    p_destinatarios: entrada.destinatarios ?? [],
    p_instrucoes: entrada.instrucoes ?? null,
    p_prioridade: entrada.prioridade ?? "normal",
    p_prazo: entrada.prazo ?? null,
    p_exige_checklist: entrada.exigeChecklist ?? false,
    p_itens_checklist: entrada.itensChecklist ?? [],
    p_exige_foto: entrada.exigeFoto ?? false,
    p_fotos_minimas: entrada.fotosMinimas ?? 0,
    p_exige_observacao: entrada.exigeObservacao ?? false,
    p_exige_aprovacao: entrada.exigeAprovacao ?? false,
  });

  if (error) {
    return { situacao: "recusado", motivo: "não foi possível criar a tarefa" };
  }

  const criada = (Array.isArray(data) ? data[0] : data) as
    | { ocorrencia_id: string; execucoes: number }
    | undefined;

  if (!criada) {
    return { situacao: "recusado", motivo: "resposta inesperada do banco" };
  }

  return { situacao: "ok", ocorrenciaId: criada.ocorrencia_id, execucoes: criada.execucoes };
}
