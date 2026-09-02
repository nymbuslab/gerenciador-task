import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  comentar,
  listarComentarios,
  listarNotificacoes,
  marcarNotificacaoLida,
} from "../../src/features/collaboration/service";
import { executarComando } from "../../src/features/tasks/task-service";
import { criarIdentidadesDeTeste, identidadePorUsuario } from "../fixtures/identities";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fixtures = criarIdentidadesDeTeste();
const [mercearia, acougue] = fixtures.setores;
const lider = identidadePorUsuario("lider.teste");
const funcionario = identidadePorUsuario("funcionario.teste");
const funcionarioOutroSetor = identidadePorUsuario("funcionario.outro");

const OCORRENCIA = "50000000-0000-4000-8000-000000000031";
const OCORRENCIA_OUTRO_SETOR = "50000000-0000-4000-8000-000000000032";
const EXECUCAO = "60000000-0000-4000-8000-000000000031";
const EXECUCAO_OUTRO_SETOR = "60000000-0000-4000-8000-000000000032";

const T0 = new Date("2026-09-01T08:00:00.000Z");
const T1 = new Date("2026-09-01T08:20:00.000Z");
const T2 = new Date("2026-09-01T08:40:00.000Z");

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
  await admin.from("mentions").delete().not("id", "is", null);
  await admin.from("comments").delete().not("id", "is", null);
  await admin.from("notifications").delete().not("id", "is", null);
  await admin.from("evidence").delete().not("id", "is", null);
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

async function semear(): Promise<void> {
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

  await admin.from("task_occurrences").insert([
    {
      id: OCORRENCIA,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Trocar etiquetas de preco",
      publico: "setor",
      exige_aprovacao: true,
    },
    {
      id: OCORRENCIA_OUTRO_SETOR,
      store_id: fixtures.loja.id,
      sector_id: acougue.id,
      titulo: "Higienizar serra de corte",
      publico: "setor",
      exige_aprovacao: false,
    },
  ]);

  await admin.from("task_recipients").insert([
    { occurrence_id: OCORRENCIA, profile_id: funcionario.perfilId },
    { occurrence_id: OCORRENCIA, profile_id: lider.perfilId },
    { occurrence_id: OCORRENCIA_OUTRO_SETOR, profile_id: funcionarioOutroSetor.perfilId },
  ]);

  await admin.from("task_executions").insert([
    {
      id: EXECUCAO,
      occurrence_id: OCORRENCIA,
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

async function reiniciar(): Promise<void> {
  await admin.from("mentions").delete().not("id", "is", null);
  await admin.from("comments").delete().not("id", "is", null);
  await admin.from("notifications").delete().not("id", "is", null);
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin
    .from("task_executions")
    .update({
      estado: "pendente",
      iniciada_em: null,
      faixa_ativa_desde: null,
      segundos_ativos: 0,
      segundos_bloqueados: 0,
      validacao_solicitada_em: null,
      validada_por: null,
      validada_em: null,
      reprovacao_motivo: null,
      concluida_em: null,
    })
    .not("id", "is", null);
}

beforeAll(async () => {
  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });

  await limpar();
  await semear();

  clienteLider = await autenticar(lider.email, lider.senha);
  clienteFuncionario = await autenticar(funcionario.email, funcionario.senha);
  clienteOutroSetor = await autenticar(funcionarioOutroSetor.email, funcionarioOutroSetor.senha);
}, 90_000);

beforeEach(async () => {
  await reiniciar();
}, 60_000);

afterAll(async () => {
  await limpar();
}, 60_000);

describe("comentarios e mencoes", () => {
  it("publica comentario na tarefa e registra auditoria", async () => {
    const resultado = await comentar(clienteFuncionario, {
      ocorrenciaId: OCORRENCIA,
      execucaoId: EXECUCAO,
      texto: "Comecei pela ponta do corredor",
    });

    if (resultado.situacao !== "ok") {
      throw new Error(`Esperava comentario, recebeu: ${resultado.motivo}`);
    }

    const comentarios = await listarComentarios(clienteLider, OCORRENCIA);
    expect(comentarios).toHaveLength(1);
    expect(comentarios[0].texto).toBe("Comecei pela ponta do corredor");
    expect(comentarios[0].autorPerfilId).toBe(funcionario.perfilId);
    expect(comentarios[0].autorNome).toBe(funcionario.nome);

    const { data } = await admin.from("audit_events").select("acao");
    expect(data?.map((evento) => evento.acao)).toContain("comentario_publicado");
  }, 60_000);

  it("avisa quem foi mencionado e ignora quem nao recebeu a tarefa", async () => {
    const resultado = await comentar(clienteFuncionario, {
      ocorrenciaId: OCORRENCIA,
      execucaoId: EXECUCAO,
      texto: "Precisa de mais etiquetas",
      mencionados: [lider.perfilId, funcionarioOutroSetor.perfilId],
    });
    expect(resultado.situacao).toBe("ok");

    const doLider = await listarNotificacoes(clienteLider);
    expect(doLider).toHaveLength(1);
    expect(doLider[0].tipo).toBe("mencao");
    expect(doLider[0].titulo).toContain("Trocar etiquetas de preco");

    // O funcionario de outro setor nao e destinatario: mencionar nao pode
    // entregar a ele o conteudo de uma tarefa que ele nao enxerga.
    expect(await listarNotificacoes(clienteOutroSetor)).toHaveLength(0);

    const comentarios = await listarComentarios(clienteFuncionario, OCORRENCIA);
    expect(comentarios[0].mencionados).toEqual([lider.perfilId]);
  }, 60_000);

  it("nao deixa comentar nem ler tarefa de outro setor", async () => {
    const invasao = await comentar(clienteOutroSetor, {
      ocorrenciaId: OCORRENCIA,
      texto: "Nao deveria entrar",
    });
    expect(invasao.situacao).toBe("recusado");

    await comentar(clienteFuncionario, { ocorrenciaId: OCORRENCIA, texto: "Conversa do setor" });
    expect(await listarComentarios(clienteOutroSetor, OCORRENCIA)).toHaveLength(0);
  }, 60_000);

  it("recusa comentario vazio antes de chegar ao banco", async () => {
    const resultado = await comentar(clienteFuncionario, {
      ocorrenciaId: OCORRENCIA,
      texto: "   ",
    });

    expect(resultado.situacao).toBe("recusado");

    const { count } = await admin.from("comments").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  }, 60_000);
});

describe("decisao de validacao", () => {
  it("devolve ao trabalho e avisa o executor quando o lider reprova", async () => {
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO, comando: "iniciar" }, T0);
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO, comando: "concluir" }, T1);

    const reprovacao = await executarComando(
      clienteLider,
      { execucaoId: EXECUCAO, comando: "reprovar", motivo: "Faltou a etiqueta do corredor 3" },
      T2,
    );

    if (reprovacao.situacao !== "ok") {
      throw new Error("esperava reprovacao");
    }
    expect(reprovacao.execucao.estado).toBe("em_execucao");

    const avisos = await listarNotificacoes(clienteFuncionario, { apenasNaoLidas: true });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].tipo).toBe("validacao_reprovar");
    expect(avisos[0].titulo).toContain("Tarefa devolvida");
    expect(avisos[0].corpo).toBe("Faltou a etiqueta do corredor 3");
    expect(avisos[0].entidadeId).toBe(EXECUCAO);

    expect(await marcarNotificacaoLida(clienteFuncionario, avisos[0].id)).toBe(true);
    expect(await listarNotificacoes(clienteFuncionario, { apenasNaoLidas: true })).toHaveLength(0);
  }, 90_000);

  it("avisa o executor quando a tarefa e aprovada", async () => {
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO, comando: "iniciar" }, T0);
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO, comando: "concluir" }, T1);
    await executarComando(clienteLider, { execucaoId: EXECUCAO, comando: "aprovar" }, T2);

    const avisos = await listarNotificacoes(clienteFuncionario);
    expect(avisos.map((aviso) => aviso.tipo)).toEqual(["validacao_aprovar"]);
    expect(avisos[0].titulo).toContain("Tarefa aprovada");
  }, 90_000);

  it("nao deixa o proprio executor aprovar a tarefa que fez", async () => {
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO, comando: "iniciar" }, T0);
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO, comando: "concluir" }, T1);

    const resultado = await executarComando(
      clienteOutroSetor,
      { execucaoId: EXECUCAO, comando: "aprovar" },
      T2,
    );

    expect(resultado.situacao).toBe("indisponivel");

    const { data } = await admin
      .from("task_executions")
      .select("estado")
      .eq("id", EXECUCAO)
      .single();
    expect(data?.estado).toBe("aguardando_validacao");
  }, 90_000);

  it("nao entrega a caixa de entrada de uma pessoa para outra", async () => {
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO, comando: "iniciar" }, T0);
    await executarComando(clienteFuncionario, { execucaoId: EXECUCAO, comando: "concluir" }, T1);
    await executarComando(
      clienteLider,
      { execucaoId: EXECUCAO, comando: "reprovar", motivo: "Refazer a gondola" },
      T2,
    );

    expect(await listarNotificacoes(clienteLider)).toHaveLength(0);
    expect(await listarNotificacoes(clienteOutroSetor)).toHaveLength(0);
    expect(await listarNotificacoes(clienteFuncionario)).toHaveLength(1);
  }, 90_000);
});
