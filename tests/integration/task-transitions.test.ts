import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { carregarExecucao, executarComando } from "../../src/features/tasks/task-service";
import { criarIdentidadesDeTeste, identidadePorUsuario } from "../fixtures/identities";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fixtures = criarIdentidadesDeTeste();
const [mercearia, acougue] = fixtures.setores;
const lider = identidadePorUsuario("lider.teste");
const funcionario = identidadePorUsuario("funcionario.teste");
const funcionarioOutroSetor = identidadePorUsuario("funcionario.outro");

const OCORRENCIA_SIMPLES = "50000000-0000-4000-8000-000000000011";
const OCORRENCIA_COM_APROVACAO = "50000000-0000-4000-8000-000000000012";
const OCORRENCIA_OUTRO_SETOR = "50000000-0000-4000-8000-000000000013";

const EXECUCAO_SIMPLES = "60000000-0000-4000-8000-000000000011";
const EXECUCAO_COM_APROVACAO = "60000000-0000-4000-8000-000000000012";
const EXECUCAO_OUTRO_SETOR = "60000000-0000-4000-8000-000000000013";

const T0 = new Date("2026-09-01T08:00:00.000Z");
const T1 = new Date("2026-09-01T08:10:00.000Z");
const T2 = new Date("2026-09-01T08:25:00.000Z");
const T3 = new Date("2026-09-01T08:30:00.000Z");

let admin: SupabaseClient;
let clienteLider: SupabaseClient;
let clienteFuncionario: SupabaseClient;
let clienteOutroSetor: SupabaseClient;

function clientePublico(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false } });
}

async function autenticar(email: string, senha: string): Promise<SupabaseClient> {
  const cliente = clientePublico();
  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });

  if (error) {
    throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  }

  return cliente;
}

async function limpar(): Promise<void> {
  await admin.from("checklist_items").delete().not("id", "is", null);
  await admin.from("task_executions").delete().not("id", "is", null);
  await admin.from("task_recipients").delete().not("id", "is", null);
  await admin.from("task_occurrences").delete().not("id", "is", null);
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin.from("memberships").delete().eq("store_id", fixtures.loja.id);
  await admin.from("profiles").delete().eq("store_id", fixtures.loja.id);
  await admin.from("sectors").delete().eq("store_id", fixtures.loja.id);
  await admin.from("stores").delete().eq("id", fixtures.loja.id);

  for (const identidade of fixtures.identidades) {
    await admin.auth.admin.deleteUser(identidade.authUserId).catch(() => undefined);
  }
}

async function semearOrganizacao(): Promise<void> {
  await admin.from("stores").insert({ id: fixtures.loja.id, nome: fixtures.loja.nome });
  await admin.from("sectors").insert(
    fixtures.setores.map((setor) => ({ id: setor.id, store_id: setor.lojaId, nome: setor.nome })),
  );

  for (const identidade of fixtures.identidades) {
    await admin.auth.admin.createUser({
      id: identidade.authUserId,
      email: identidade.email,
      password: identidade.senha,
      email_confirm: true,
    });
  }

  await admin.from("profiles").insert(
    fixtures.identidades.map((identidade) => ({
      id: identidade.perfilId,
      auth_user_id: identidade.authUserId,
      store_id: identidade.lojaId,
      nome: identidade.nome,
      usuario: identidade.usuario,
      email: identidade.email,
    })),
  );

  await admin.from("memberships").insert(
    fixtures.identidades.map((identidade) => ({
      profile_id: identidade.perfilId,
      store_id: identidade.lojaId,
      sector_id: identidade.setorId,
      papel: identidade.papel,
    })),
  );
}

async function semearTarefas(): Promise<void> {
  await admin.from("task_occurrences").insert([
    {
      id: OCORRENCIA_SIMPLES,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Repor gondola de bebidas",
      publico: "pessoa",
      modo_conclusao: "individual",
      exige_aprovacao: false,
    },
    {
      id: OCORRENCIA_COM_APROVACAO,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Trocar etiquetas de preco",
      publico: "pessoa",
      modo_conclusao: "individual",
      exige_aprovacao: true,
    },
    {
      id: OCORRENCIA_OUTRO_SETOR,
      store_id: fixtures.loja.id,
      sector_id: acougue.id,
      titulo: "Higienizar serra de corte",
      publico: "pessoa",
      modo_conclusao: "individual",
      exige_aprovacao: false,
    },
  ]);

  await admin.from("task_recipients").insert([
    { occurrence_id: OCORRENCIA_SIMPLES, profile_id: funcionario.perfilId },
    { occurrence_id: OCORRENCIA_COM_APROVACAO, profile_id: funcionario.perfilId },
    { occurrence_id: OCORRENCIA_OUTRO_SETOR, profile_id: funcionarioOutroSetor.perfilId },
  ]);

  await admin.from("task_executions").insert([
    {
      id: EXECUCAO_SIMPLES,
      occurrence_id: OCORRENCIA_SIMPLES,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      responsavel_perfil_id: funcionario.perfilId,
      compartilhada: false,
    },
    {
      id: EXECUCAO_COM_APROVACAO,
      occurrence_id: OCORRENCIA_COM_APROVACAO,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      responsavel_perfil_id: funcionario.perfilId,
      compartilhada: false,
    },
    {
      id: EXECUCAO_OUTRO_SETOR,
      occurrence_id: OCORRENCIA_OUTRO_SETOR,
      store_id: fixtures.loja.id,
      sector_id: acougue.id,
      responsavel_perfil_id: funcionarioOutroSetor.perfilId,
      compartilhada: false,
    },
  ]);
}

async function reiniciarExecucoes(): Promise<void> {
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin
    .from("task_executions")
    .update({
      estado: "pendente",
      iniciada_em: null,
      faixa_ativa_desde: null,
      bloqueada_em: null,
      bloqueio_motivo: null,
      segundos_ativos: 0,
      segundos_bloqueados: 0,
      validacao_solicitada_em: null,
      validada_por: null,
      validada_em: null,
      reprovacao_motivo: null,
      concluida_em: null,
      cancelada_em: null,
    })
    .not("id", "is", null);
}

beforeAll(async () => {
  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });

  await limpar();
  await semearOrganizacao();
  await semearTarefas();

  clienteLider = await autenticar(lider.email, lider.senha);
  clienteFuncionario = await autenticar(funcionario.email, funcionario.senha);
  clienteOutroSetor = await autenticar(
    funcionarioOutroSetor.email,
    funcionarioOutroSetor.senha,
  );
}, 90_000);

beforeEach(async () => {
  await reiniciarExecucoes();
}, 60_000);

afterAll(async () => {
  await limpar();
}, 60_000);

describe("ciclo de uma tarefa individual", () => {
  it("percorre pendente, execucao, bloqueio, retomada e conclusao com tempos corretos", async () => {
    const inicio = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_SIMPLES, comando: "iniciar" },
      T0,
    );
    expect(inicio.situacao).toBe("ok");
    if (inicio.situacao !== "ok") throw new Error("esperava inicio");
    expect(inicio.execucao.estado).toBe("em_execucao");

    const bloqueio = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_SIMPLES, comando: "bloquear", motivo: "Faltou produto no estoque" },
      T1,
    );
    if (bloqueio.situacao !== "ok") throw new Error("esperava bloqueio");
    expect(bloqueio.execucao.estado).toBe("bloqueada");
    expect(bloqueio.execucao.segundosAtivos).toBe(600);

    const retomada = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_SIMPLES, comando: "retomar" },
      T2,
    );
    if (retomada.situacao !== "ok") throw new Error("esperava retomada");
    expect(retomada.execucao.estado).toBe("em_execucao");
    expect(retomada.execucao.segundosBloqueados).toBe(900);

    const conclusao = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_SIMPLES, comando: "concluir" },
      T3,
    );
    if (conclusao.situacao !== "ok") throw new Error("esperava conclusao");

    expect(conclusao.execucao.estado).toBe("concluida");
    expect(conclusao.execucao.segundosAtivos).toBe(900);
    expect(conclusao.execucao.segundosBloqueados).toBe(900);
    expect(conclusao.execucao.concluidaEm).toBe(T3.toISOString());
  }, 60_000);

  it("grava um evento de auditoria por transicao, junto com a mudanca", async () => {
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO_SIMPLES, comando: "iniciar" }, T0);
    await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_SIMPLES, comando: "bloquear", motivo: "Sem chave do deposito" },
      T1,
    );

    const { data } = await admin
      .from("audit_events")
      .select("acao, entidade, entidade_id, ator_perfil_id")
      .order("created_at");

    expect(data).toEqual([
      {
        acao: "execucao_iniciar",
        entidade: "task_executions",
        entidade_id: EXECUCAO_SIMPLES,
        ator_perfil_id: funcionario.perfilId,
      },
      {
        acao: "execucao_bloquear",
        entidade: "task_executions",
        entidade_id: EXECUCAO_SIMPLES,
        ator_perfil_id: funcionario.perfilId,
      },
    ]);
  }, 60_000);

  it("envia para validacao e conclui pela aprovacao do lider", async () => {
    await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_APROVACAO, comando: "iniciar" },
      T0,
    );

    const pedido = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_APROVACAO, comando: "concluir" },
      T1,
    );
    if (pedido.situacao !== "ok") throw new Error("esperava pedido de validacao");
    expect(pedido.execucao.estado).toBe("aguardando_validacao");
    expect(pedido.execucao.concluidaEm).toBeNull();

    const aprovacao = await executarComando(
      clienteLider,
      { execucaoId: EXECUCAO_COM_APROVACAO, comando: "aprovar" },
      T2,
    );
    if (aprovacao.situacao !== "ok") throw new Error("esperava aprovacao");
    expect(aprovacao.execucao.estado).toBe("concluida");

    const { data } = await admin
      .from("task_executions")
      .select("validada_por")
      .eq("id", EXECUCAO_COM_APROVACAO)
      .single();
    expect(data?.validada_por).toBe(lider.perfilId);
  }, 60_000);

  it("devolve ao trabalho quando o lider reprova com justificativa", async () => {
    await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_APROVACAO, comando: "iniciar" },
      T0,
    );
    await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_APROVACAO, comando: "concluir" },
      T1,
    );

    const semMotivo = await executarComando(
      clienteLider,
      { execucaoId: EXECUCAO_COM_APROVACAO, comando: "reprovar" },
      T2,
    );
    expect(semMotivo.situacao).toBe("recusado");

    const reprovacao = await executarComando(
      clienteLider,
      {
        execucaoId: EXECUCAO_COM_APROVACAO,
        comando: "reprovar",
        motivo: "Faltou a foto da gondola",
      },
      T2,
    );
    if (reprovacao.situacao !== "ok") throw new Error("esperava reprovacao");

    expect(reprovacao.execucao.estado).toBe("em_execucao");
    expect(reprovacao.execucao.reprovacaoMotivo).toBe("Faltou a foto da gondola");
  }, 60_000);
});

describe("transicoes proibidas e concorrencia", () => {
  it("recusa comando fora da ordem sem tocar no banco", async () => {
    const antes = await carregarExecucao(clienteFuncionario, EXECUCAO_SIMPLES);

    const resultado = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_SIMPLES, comando: "concluir" },
      T1,
    );
    expect(resultado.situacao).toBe("recusado");

    const depois = await carregarExecucao(clienteFuncionario, EXECUCAO_SIMPLES);
    expect(depois?.version).toBe(antes?.version);
    expect(depois?.estado).toBe("pendente");

    const { count } = await admin
      .from("audit_events")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  }, 60_000);

  it("recusa a segunda gravacao de uma leitura antiga", async () => {
    const antiga = await carregarExecucao(clienteFuncionario, EXECUCAO_SIMPLES);
    expect(antiga).not.toBeNull();

    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO_SIMPLES, comando: "iniciar" }, T0);

    const { error } = await clienteFuncionario.rpc("aplicar_transicao_tarefa", {
      p_execucao: EXECUCAO_SIMPLES,
      p_versao_esperada: antiga!.version,
      p_acao: "iniciar",
      p_campos: {
        estado: "em_execucao",
        iniciada_em: T2.toISOString(),
        faixa_ativa_desde: T2.toISOString(),
        bloqueada_em: null,
        bloqueio_motivo: null,
        segundos_ativos: 0,
        segundos_bloqueados: 0,
        validacao_solicitada_em: null,
        reprovacao_motivo: null,
        concluida_em: null,
        cancelada_em: null,
      },
    });

    expect(error?.code).toBe("P0002");
  }, 60_000);

  it("ignora o estado que o cliente manda e deriva a transicao no banco", async () => {
    const antes = await carregarExecucao(clienteFuncionario, EXECUCAO_SIMPLES);
    expect(antes?.estado).toBe("pendente");

    // Cliente pede "concluir" numa tarefa que nem comecou, mandando o estado
    // final de bandeja. A maquina de estados do navegador nao pode ser a unica
    // barreira: chamada direta pula a tela inteira.
    const { error } = await clienteFuncionario.rpc("aplicar_transicao_tarefa", {
      p_execucao: EXECUCAO_SIMPLES,
      p_versao_esperada: antes!.version,
      p_acao: "concluir",
      p_campos: {
        estado: "concluida",
        iniciada_em: null,
        faixa_ativa_desde: null,
        bloqueada_em: null,
        bloqueio_motivo: null,
        segundos_ativos: 0,
        segundos_bloqueados: 0,
        validacao_solicitada_em: null,
        reprovacao_motivo: null,
        concluida_em: T3.toISOString(),
        cancelada_em: null,
      },
    });

    expect(error?.code).toBe("42501");

    const depois = await carregarExecucao(clienteFuncionario, EXECUCAO_SIMPLES);
    expect(depois?.estado).toBe("pendente");
    expect(depois?.version).toBe(antes?.version);
  }, 60_000);

  it("nao deixa uma pessoa comandar a execucao de outro setor", async () => {
    const resultado = await executarComando(
      clienteOutroSetor,
      { execucaoId: EXECUCAO_SIMPLES, comando: "iniciar" },
      T0,
    );

    expect(resultado.situacao).toBe("indisponivel");

    const { data } = await admin
      .from("task_executions")
      .select("estado")
      .eq("id", EXECUCAO_SIMPLES)
      .single();
    expect(data?.estado).toBe("pendente");
  }, 60_000);

  it("recusa bloqueio sem motivo antes de chegar ao banco", async () => {
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO_SIMPLES, comando: "iniciar" }, T0);

    const resultado = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_SIMPLES, comando: "bloquear" },
      T1,
    );

    expect(resultado.situacao).toBe("recusado");

    const depois = await carregarExecucao(clienteFuncionario, EXECUCAO_SIMPLES);
    expect(depois?.estado).toBe("em_execucao");
  }, 60_000);
});
