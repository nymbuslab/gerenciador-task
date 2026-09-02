/**
 * Maquina de estados da execucao de uma tarefa (docs/tasks-workflows.md).
 *
 * Aqui nao ha banco nem transporte: entra uma execucao e um comando, sai a
 * proxima execucao ou uma recusa. O tempo bloqueado e contado a parte do tempo
 * ativo de proposito, porque a metrica de duracao mede trabalho, e nao a espera
 * por um impedimento.
 */

export const ESTADOS = [
  "pendente",
  "em_execucao",
  "bloqueada",
  "aguardando_validacao",
  "concluida",
  "cancelada",
] as const;

export type EstadoExecucao = (typeof ESTADOS)[number];

export const COMANDOS = [
  "iniciar",
  "bloquear",
  "retomar",
  "concluir",
  "aprovar",
  "reprovar",
  "cancelar",
] as const;

export type Comando = (typeof COMANDOS)[number];

export type Execucao = {
  estado: EstadoExecucao;
  iniciadaEm: string | null;
  faixaAtivaDesde: string | null;
  bloqueadaEm: string | null;
  bloqueioMotivo: string | null;
  segundosAtivos: number;
  segundosBloqueados: number;
  validacaoSolicitadaEm: string | null;
  reprovacaoMotivo: string | null;
  concluidaEm: string | null;
  canceladaEm: string | null;
};

export type EntradaComando = {
  motivo?: string;
  exigeAprovacao?: boolean;
};

export type ResultadoTransicao =
  | { situacao: "ok"; execucao: Execucao }
  | { situacao: "recusado"; motivo: string };

const ORIGENS_PERMITIDAS: Record<Comando, EstadoExecucao[]> = {
  iniciar: ["pendente"],
  bloquear: ["em_execucao"],
  retomar: ["bloqueada"],
  concluir: ["em_execucao"],
  aprovar: ["aguardando_validacao"],
  reprovar: ["aguardando_validacao"],
  cancelar: ["pendente", "em_execucao", "bloqueada", "aguardando_validacao"],
};

const COMANDOS_COM_MOTIVO: Comando[] = ["bloquear", "reprovar", "cancelar"];

export function execucaoInicial(): Execucao {
  return {
    estado: "pendente",
    iniciadaEm: null,
    faixaAtivaDesde: null,
    bloqueadaEm: null,
    bloqueioMotivo: null,
    segundosAtivos: 0,
    segundosBloqueados: 0,
    validacaoSolicitadaEm: null,
    reprovacaoMotivo: null,
    concluidaEm: null,
    canceladaEm: null,
  };
}

function recusado(motivo: string): ResultadoTransicao {
  return { situacao: "recusado", motivo };
}

function segundosEntre(desde: string, ate: Date): number {
  return Math.round((ate.getTime() - new Date(desde).getTime()) / 1000);
}

function fecharFaixaAtiva(execucao: Execucao, agora: Date): Execucao {
  if (!execucao.faixaAtivaDesde) {
    return execucao;
  }

  return {
    ...execucao,
    segundosAtivos: execucao.segundosAtivos + segundosEntre(execucao.faixaAtivaDesde, agora),
    faixaAtivaDesde: null,
  };
}

function fecharFaixaBloqueada(execucao: Execucao, agora: Date): Execucao {
  if (!execucao.bloqueadaEm) {
    return execucao;
  }

  return {
    ...execucao,
    segundosBloqueados: execucao.segundosBloqueados + segundosEntre(execucao.bloqueadaEm, agora),
    bloqueadaEm: null,
  };
}

export function aplicarComando(
  execucao: Execucao,
  comando: Comando,
  agora: Date,
  entrada: EntradaComando = {},
): ResultadoTransicao {
  if (!ORIGENS_PERMITIDAS[comando].includes(execucao.estado)) {
    return recusado(`o comando ${comando} não se aplica ao estado ${execucao.estado}`);
  }

  const motivo = entrada.motivo?.trim() ?? "";

  if (COMANDOS_COM_MOTIVO.includes(comando) && motivo.length === 0) {
    return recusado(`o comando ${comando} exige motivo`);
  }

  // Um comando nunca pode chegar antes do instante que ele mesmo encerra: isso
  // produziria tempo ativo ou bloqueado negativo.
  const marcoAberto = execucao.faixaAtivaDesde ?? execucao.bloqueadaEm;

  if (marcoAberto && agora.getTime() < new Date(marcoAberto).getTime()) {
    return recusado("o instante do comando é anterior ao início da faixa em aberto");
  }

  const instante = agora.toISOString();

  switch (comando) {
    case "iniciar":
      return {
        situacao: "ok",
        execucao: {
          ...execucao,
          estado: "em_execucao",
          iniciadaEm: execucao.iniciadaEm ?? instante,
          faixaAtivaDesde: instante,
        },
      };

    case "bloquear": {
      const fechada = fecharFaixaAtiva(execucao, agora);

      return {
        situacao: "ok",
        execucao: {
          ...fechada,
          estado: "bloqueada",
          bloqueadaEm: instante,
          bloqueioMotivo: motivo,
        },
      };
    }

    case "retomar": {
      const fechada = fecharFaixaBloqueada(execucao, agora);

      return {
        situacao: "ok",
        execucao: {
          ...fechada,
          estado: "em_execucao",
          bloqueioMotivo: null,
          faixaAtivaDesde: instante,
        },
      };
    }

    case "concluir": {
      const fechada = fecharFaixaAtiva(execucao, agora);

      if (entrada.exigeAprovacao) {
        return {
          situacao: "ok",
          execucao: {
            ...fechada,
            estado: "aguardando_validacao",
            validacaoSolicitadaEm: instante,
          },
        };
      }

      return {
        situacao: "ok",
        execucao: { ...fechada, estado: "concluida", concluidaEm: instante },
      };
    }

    case "aprovar":
      return {
        situacao: "ok",
        execucao: { ...execucao, estado: "concluida", concluidaEm: instante },
      };

    case "reprovar":
      return {
        situacao: "ok",
        execucao: {
          ...execucao,
          estado: "em_execucao",
          reprovacaoMotivo: motivo,
          validacaoSolicitadaEm: null,
          faixaAtivaDesde: instante,
        },
      };

    case "cancelar": {
      const semAtiva = fecharFaixaAtiva(execucao, agora);
      const semBloqueio = fecharFaixaBloqueada(semAtiva, agora);

      return {
        situacao: "ok",
        execucao: { ...semBloqueio, estado: "cancelada", canceladaEm: instante },
      };
    }
  }
}
