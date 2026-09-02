import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarIdentidadesDeTeste, identidadePorUsuario } from "../fixtures/identities";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CODIGO_PERMISSAO_NEGADA = "42501";
const CODIGO_DUPLICADO = "23505";
const CODIGO_RESTRICAO = "23514";

const fixtures = criarIdentidadesDeTeste();
const [mercearia, acougue] = fixtures.setores;
const gestor = identidadePorUsuario("gestor.teste");
const lider = identidadePorUsuario("lider.teste");
const funcionario = identidadePorUsuario("funcionario.teste");
const funcionarioOutroSetor = identidadePorUsuario("funcionario.outro");

const OCORRENCIAS = {
  pessoal: "50000000-0000-4000-8000-000000000001",
  coletivaMercearia: "50000000-0000-4000-8000-000000000002",
  setorAcougue: "50000000-0000-4000-8000-000000000003",
  lojaInteira: "50000000-0000-4000-8000-000000000004",
};

const EXECUCOES = {
  pessoal: "60000000-0000-4000-8000-000000000001",
  coletiva: "60000000-0000-4000-8000-000000000002",
  acougue: "60000000-0000-4000-8000-000000000003",
};

let admin: SupabaseClient;
let clienteGestor: SupabaseClient;
let clienteLider: SupabaseClient;
let clienteFuncionario: SupabaseClient;
let clienteFuncionarioOutroSetor: SupabaseClient;
let clienteAnonimo: SupabaseClient;

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
  await admin.from("task_templates").delete().not("id", "is", null);
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
  const { error: erroOcorrencias } = await admin.from("task_occurrences").insert([
    {
      id: OCORRENCIAS.pessoal,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Repor gondola de bebidas",
      publico: "pessoa",
      modo_conclusao: "individual",
      criado_por: lider.perfilId,
    },
    {
      id: OCORRENCIAS.coletivaMercearia,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Limpeza do corredor central",
      publico: "setor",
      modo_conclusao: "coletiva",
      criado_por: lider.perfilId,
    },
    {
      id: OCORRENCIAS.setorAcougue,
      store_id: fixtures.loja.id,
      sector_id: acougue.id,
      titulo: "Higienizar serra de corte",
      publico: "setor",
      modo_conclusao: "individual",
      criado_por: gestor.perfilId,
    },
    {
      id: OCORRENCIAS.lojaInteira,
      store_id: fixtures.loja.id,
      sector_id: null,
      titulo: "Conferir saidas de emergencia",
      publico: "todos",
      modo_conclusao: "individual",
      criado_por: gestor.perfilId,
    },
  ]);
  expect(erroOcorrencias, "insercao das ocorrencias").toBeNull();

  const { error: erroDestinatarios } = await admin.from("task_recipients").insert([
    { occurrence_id: OCORRENCIAS.pessoal, profile_id: funcionario.perfilId },
    { occurrence_id: OCORRENCIAS.coletivaMercearia, profile_id: funcionario.perfilId },
    { occurrence_id: OCORRENCIAS.coletivaMercearia, profile_id: lider.perfilId },
    { occurrence_id: OCORRENCIAS.setorAcougue, profile_id: funcionarioOutroSetor.perfilId },
    { occurrence_id: OCORRENCIAS.lojaInteira, profile_id: funcionario.perfilId },
    { occurrence_id: OCORRENCIAS.lojaInteira, profile_id: funcionarioOutroSetor.perfilId },
  ]);
  expect(erroDestinatarios, "insercao dos destinatarios").toBeNull();

  const { error: erroExecucoes } = await admin.from("task_executions").insert([
    // O insert em lote do PostgREST monta as colunas pela uniao das chaves e
    // preenche com NULL o que faltar em cada objeto. Por isso todos declaram o
    // mesmo conjunto de campos.
    {
      id: EXECUCOES.pessoal,
      occurrence_id: OCORRENCIAS.pessoal,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      responsavel_perfil_id: funcionario.perfilId,
      compartilhada: false,
    },
    {
      id: EXECUCOES.coletiva,
      occurrence_id: OCORRENCIAS.coletivaMercearia,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      responsavel_perfil_id: null,
      compartilhada: true,
    },
    {
      id: EXECUCOES.acougue,
      occurrence_id: OCORRENCIAS.setorAcougue,
      store_id: fixtures.loja.id,
      sector_id: acougue.id,
      responsavel_perfil_id: funcionarioOutroSetor.perfilId,
      compartilhada: false,
    },
  ]);
  expect(erroExecucoes, "insercao das execucoes").toBeNull();

  const { error: erroChecklist } = await admin.from("checklist_items").insert([
    { execution_id: EXECUCOES.pessoal, ordem: 0, descricao: "Conferir validade" },
    { execution_id: EXECUCOES.acougue, ordem: 0, descricao: "Desmontar a serra" },
  ]);
  expect(erroChecklist, "insercao do checklist").toBeNull();
}

beforeAll(async () => {
  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });

  await limpar();
  await semearOrganizacao();
  await semearTarefas();

  clienteGestor = await autenticar(gestor.email, gestor.senha);
  clienteLider = await autenticar(lider.email, lider.senha);
  clienteFuncionario = await autenticar(funcionario.email, funcionario.senha);
  clienteFuncionarioOutroSetor = await autenticar(
    funcionarioOutroSetor.email,
    funcionarioOutroSetor.senha,
  );
  clienteAnonimo = clientePublico();
}, 90_000);

afterAll(async () => {
  await limpar();
}, 60_000);

async function idsVisiveis(cliente: SupabaseClient): Promise<string[]> {
  const { data, error } = await cliente.from("task_occurrences").select("id");

  expect(error).toBeNull();

  return (data ?? []).map((linha) => linha.id).sort();
}

describe("visibilidade de ocorrencias por papel", () => {
  it("o gestor enxerga toda a loja", async () => {
    expect(await idsVisiveis(clienteGestor)).toEqual(Object.values(OCORRENCIAS).sort());
  });

  it("o lider enxerga o proprio setor e o que vale para a loja inteira", async () => {
    expect(await idsVisiveis(clienteLider)).toEqual(
      [OCORRENCIAS.pessoal, OCORRENCIAS.coletivaMercearia, OCORRENCIAS.lojaInteira].sort(),
    );
  });

  it("o funcionario lista suas tarefas pessoais e coletivas sem receber inelegiveis", async () => {
    const visiveis = await idsVisiveis(clienteFuncionario);

    expect(visiveis).toEqual(
      [OCORRENCIAS.pessoal, OCORRENCIAS.coletivaMercearia, OCORRENCIAS.lojaInteira].sort(),
    );
    expect(visiveis).not.toContain(OCORRENCIAS.setorAcougue);
  });

  it("o funcionario de outro setor recebe apenas o que lhe foi destinado", async () => {
    expect(await idsVisiveis(clienteFuncionarioOutroSetor)).toEqual(
      [OCORRENCIAS.setorAcougue, OCORRENCIAS.lojaInteira].sort(),
    );
  });

  it("o cliente anonimo nao enxerga tarefa alguma", async () => {
    for (const tabela of [
      "task_occurrences",
      "task_recipients",
      "task_executions",
      "checklist_items",
    ]) {
      const { data, error } = await clienteAnonimo.from(tabela).select("id");

      expect(error, `tabela ${tabela}`).not.toBeNull();
      expect(data, `tabela ${tabela}`).toBeNull();
    }
  });
});

describe("criacao de ocorrencias por papel", () => {
  it("o lider cria no proprio setor e e recusado fora dele", async () => {
    const { data: propria, error: erroPropria } = await clienteLider
      .from("task_occurrences")
      .insert({
        store_id: fixtures.loja.id,
        sector_id: mercearia.id,
        titulo: "Conferir precos da gondola",
        publico: "setor",
      })
      .select("id")
      .maybeSingle();

    expect(erroPropria).toBeNull();
    expect(propria?.id).toBeTruthy();

    const { error: erroAlheia } = await clienteLider.from("task_occurrences").insert({
      store_id: fixtures.loja.id,
      sector_id: acougue.id,
      titulo: "Tarefa invasora",
      publico: "setor",
    });
    expect(erroAlheia?.code).toBe(CODIGO_PERMISSAO_NEGADA);

    const { error: erroLojaInteira } = await clienteLider.from("task_occurrences").insert({
      store_id: fixtures.loja.id,
      sector_id: null,
      titulo: "Tarefa para a loja toda",
      publico: "todos",
    });
    expect(erroLojaInteira?.code).toBe(CODIGO_PERMISSAO_NEGADA);

    await admin.from("task_occurrences").delete().eq("id", propria!.id);
  });

  it("o funcionario nao cria tarefa", async () => {
    const { error } = await clienteFuncionario.from("task_occurrences").insert({
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Tarefa criada por funcionario",
      publico: "setor",
    });

    expect(error?.code).toBe(CODIGO_PERMISSAO_NEGADA);
  });

  it("o gestor cria em qualquer setor e para a loja inteira", async () => {
    const { data, error } = await clienteGestor
      .from("task_occurrences")
      .insert([
        {
          store_id: fixtures.loja.id,
          sector_id: acougue.id,
          titulo: "Revisar camara fria",
          publico: "setor",
        },
        {
          store_id: fixtures.loja.id,
          sector_id: null,
          titulo: "Treinamento de seguranca",
          publico: "todos",
        },
      ])
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    await admin
      .from("task_occurrences")
      .delete()
      .in(
        "id",
        (data ?? []).map((linha) => linha.id),
      );
  });
});

describe("execucoes e checklist", () => {
  it("o funcionario atualiza a propria execucao e a compartilhada de que participa", async () => {
    const { data: propria, error: erroPropria } = await clienteFuncionario
      .from("task_executions")
      .update({ observacao: "iniciando a reposicao" })
      .eq("id", EXECUCOES.pessoal)
      .select("id");

    expect(erroPropria).toBeNull();
    expect(propria).toEqual([{ id: EXECUCOES.pessoal }]);

    const { data: coletiva } = await clienteFuncionario
      .from("task_executions")
      .update({ observacao: "assumindo o corredor" })
      .eq("id", EXECUCOES.coletiva)
      .select("id");

    expect(coletiva).toEqual([{ id: EXECUCOES.coletiva }]);
  });

  it("o funcionario nao alcanca execucao de outro setor", async () => {
    const { data: leitura } = await clienteFuncionario
      .from("task_executions")
      .select("id")
      .eq("id", EXECUCOES.acougue);
    expect(leitura).toEqual([]);

    const { data: escrita } = await clienteFuncionario
      .from("task_executions")
      .update({ observacao: "nao deveria entrar" })
      .eq("id", EXECUCOES.acougue)
      .select("id");
    expect(escrita).toEqual([]);
  });

  it("o lider alcanca as execucoes do proprio setor e nao as de outro", async () => {
    const { data } = await clienteLider.from("task_executions").select("id");

    expect(data?.map((linha) => linha.id).sort()).toEqual(
      [EXECUCOES.pessoal, EXECUCOES.coletiva].sort(),
    );
  });

  it("o checklist acompanha a visibilidade da execucao", async () => {
    const { data: doFuncionario } = await clienteFuncionario
      .from("checklist_items")
      .select("execution_id");
    expect(doFuncionario).toEqual([{ execution_id: EXECUCOES.pessoal }]);

    const { data: doGestor } = await clienteGestor.from("checklist_items").select("execution_id");
    expect(doGestor).toHaveLength(2);
  });
});

describe("integridade do dominio", () => {
  it("aceita apenas uma execucao compartilhada por ocorrencia", async () => {
    const { error } = await admin.from("task_executions").insert({
      occurrence_id: OCORRENCIAS.coletivaMercearia,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      compartilhada: true,
    });

    expect(error?.code).toBe(CODIGO_DUPLICADO);
  });

  it("aceita apenas uma execucao individual por destinatario", async () => {
    const { error } = await admin.from("task_executions").insert({
      occurrence_id: OCORRENCIAS.pessoal,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      responsavel_perfil_id: funcionario.perfilId,
    });

    expect(error?.code).toBe(CODIGO_DUPLICADO);
  });

  it("exige motivo para deixar uma execucao bloqueada", async () => {
    const { error } = await admin
      .from("task_executions")
      .update({ estado: "bloqueada" })
      .eq("id", EXECUCOES.pessoal);

    expect(error?.code).toBe(CODIGO_RESTRICAO);
  });

  it("recusa tarefa para a loja inteira presa a um setor", async () => {
    const { error } = await admin.from("task_occurrences").insert({
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Publico incoerente",
      publico: "todos",
    });

    expect(error?.code).toBe(CODIGO_RESTRICAO);
  });

  it("recusa exigencia de foto sem quantidade minima", async () => {
    const { error } = await admin.from("task_occurrences").insert({
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Foto sem minimo",
      publico: "setor",
      exige_foto: true,
      fotos_minimas: 0,
    });

    expect(error?.code).toBe(CODIGO_RESTRICAO);
  });

  it("recusa janela com fim anterior ao inicio", async () => {
    const { error } = await admin.from("task_occurrences").insert({
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Janela invertida",
      publico: "setor",
      janela_inicio: "2026-09-01T12:00:00Z",
      janela_fim: "2026-09-01T08:00:00Z",
    });

    expect(error?.code).toBe(CODIGO_RESTRICAO);
  });
});
