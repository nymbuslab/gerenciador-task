import { describe, expect, it } from "vitest";

import {
  aplicarComando,
  COMANDOS,
  ESTADOS,
  execucaoInicial,
  type Comando,
  type EstadoExecucao,
  type Execucao,
} from "@/src/features/tasks/domain";

const T0 = new Date("2026-09-01T08:00:00.000Z");
const T1 = new Date("2026-09-01T08:10:00.000Z");
const T2 = new Date("2026-09-01T08:25:00.000Z");
const T3 = new Date("2026-09-01T08:30:00.000Z");

function aplicar(
  execucao: Execucao,
  comando: Comando,
  agora: Date,
  entrada: Parameters<typeof aplicarComando>[3] = {},
): Execucao {
  const resultado = aplicarComando(execucao, comando, agora, entrada);

  if (resultado.situacao !== "ok") {
    throw new Error(`Esperava transição, recebeu recusa: ${resultado.motivo}`);
  }

  return resultado.execucao;
}

describe("transições permitidas", () => {
  it("leva uma tarefa individual de pendente até concluída", () => {
    let execucao = execucaoInicial();
    expect(execucao.estado).toBe("pendente");

    execucao = aplicar(execucao, "iniciar", T0);
    expect(execucao.estado).toBe("em_execucao");
    expect(execucao.iniciadaEm).toBe(T0.toISOString());

    execucao = aplicar(execucao, "bloquear", T1, { motivo: "Faltou produto no estoque" });
    expect(execucao.estado).toBe("bloqueada");
    expect(execucao.segundosAtivos).toBe(600);
    expect(execucao.faixaAtivaDesde).toBeNull();

    execucao = aplicar(execucao, "retomar", T2);
    expect(execucao.estado).toBe("em_execucao");
    expect(execucao.segundosBloqueados).toBe(900);
    expect(execucao.bloqueadaEm).toBeNull();

    execucao = aplicar(execucao, "concluir", T3);
    expect(execucao.estado).toBe("concluida");
    expect(execucao.segundosAtivos).toBe(900);
    expect(execucao.segundosBloqueados).toBe(900);
    expect(execucao.concluidaEm).toBe(T3.toISOString());
  });

  it("envia para validação quando a tarefa exige aprovação", () => {
    let execucao = aplicar(execucaoInicial(), "iniciar", T0);
    execucao = aplicar(execucao, "concluir", T1, { exigeAprovacao: true });

    expect(execucao.estado).toBe("aguardando_validacao");
    expect(execucao.concluidaEm).toBeNull();
    expect(execucao.segundosAtivos).toBe(600);
    expect(execucao.validacaoSolicitadaEm).toBe(T1.toISOString());
  });

  it("conclui após aprovação e devolve ao trabalho após reprovação", () => {
    const emValidacao = aplicar(
      aplicar(execucaoInicial(), "iniciar", T0),
      "concluir",
      T1,
      { exigeAprovacao: true },
    );

    const aprovada = aplicar(emValidacao, "aprovar", T2);
    expect(aprovada.estado).toBe("concluida");
    expect(aprovada.concluidaEm).toBe(T2.toISOString());

    const reprovada = aplicar(emValidacao, "reprovar", T2, { motivo: "Faltou a foto da gôndola" });
    expect(reprovada.estado).toBe("em_execucao");
    expect(reprovada.reprovacaoMotivo).toBe("Faltou a foto da gôndola");
    expect(reprovada.faixaAtivaDesde).toBe(T2.toISOString());
  });

  it("cancela a partir de qualquer estado ainda aberto", () => {
    const abertos: EstadoExecucao[] = [
      "pendente",
      "em_execucao",
      "bloqueada",
      "aguardando_validacao",
    ];

    for (const estado of abertos) {
      const resultado = aplicarComando({ ...execucaoInicial(), estado }, "cancelar", T3, {
        motivo: "Loja fechou mais cedo",
      });

      expect(resultado.situacao, `cancelar a partir de ${estado}`).toBe("ok");
    }
  });

  it("não conta o tempo bloqueado como tempo ativo", () => {
    let execucao = aplicar(execucaoInicial(), "iniciar", T0);
    execucao = aplicar(execucao, "bloquear", T1, { motivo: "Sem chave do depósito" });
    execucao = aplicar(execucao, "retomar", T2);
    execucao = aplicar(execucao, "concluir", T3);

    const total = (T3.getTime() - T0.getTime()) / 1000;
    expect(execucao.segundosAtivos + execucao.segundosBloqueados).toBe(total);
    expect(execucao.segundosAtivos).toBeLessThan(total);
  });
});

describe("transições proibidas", () => {
  it("recusa qualquer comando em estado terminal", () => {
    for (const estado of ["concluida", "cancelada"] as EstadoExecucao[]) {
      for (const comando of COMANDOS) {
        const resultado = aplicarComando({ ...execucaoInicial(), estado }, comando, T3, {
          motivo: "qualquer",
        });

        expect(resultado.situacao, `${comando} a partir de ${estado}`).toBe("recusado");
      }
    }
  });

  it("recusa iniciar duas vezes e retomar sem bloqueio", () => {
    const emExecucao = aplicar(execucaoInicial(), "iniciar", T0);

    expect(aplicarComando(emExecucao, "iniciar", T1, {}).situacao).toBe("recusado");
    expect(aplicarComando(emExecucao, "retomar", T1, {}).situacao).toBe("recusado");
    expect(aplicarComando(emExecucao, "aprovar", T1, {}).situacao).toBe("recusado");
  });

  it("recusa concluir ou bloquear uma tarefa que nem começou", () => {
    const pendente = execucaoInicial();

    expect(aplicarComando(pendente, "concluir", T1, {}).situacao).toBe("recusado");
    expect(aplicarComando(pendente, "bloquear", T1, { motivo: "x" }).situacao).toBe("recusado");
  });

  it("exige motivo para bloquear, reprovar e cancelar", () => {
    const emExecucao = aplicar(execucaoInicial(), "iniciar", T0);
    const emValidacao = aplicar(emExecucao, "concluir", T1, { exigeAprovacao: true });

    expect(aplicarComando(emExecucao, "bloquear", T1, {}).situacao).toBe("recusado");
    expect(aplicarComando(emExecucao, "bloquear", T1, { motivo: "   " }).situacao).toBe("recusado");
    expect(aplicarComando(emValidacao, "reprovar", T2, {}).situacao).toBe("recusado");
    expect(aplicarComando(emExecucao, "cancelar", T2, {}).situacao).toBe("recusado");
  });

  it("recusa comando com instante anterior ao início da faixa", () => {
    const emExecucao = aplicar(execucaoInicial(), "iniciar", T2);

    expect(aplicarComando(emExecucao, "concluir", T0, {}).situacao).toBe("recusado");
  });

  it("cobre todos os estados declarados", () => {
    expect(ESTADOS).toEqual([
      "pendente",
      "em_execucao",
      "bloqueada",
      "aguardando_validacao",
      "concluida",
      "cancelada",
    ]);
  });
});
