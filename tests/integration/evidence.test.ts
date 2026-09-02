import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  BUCKET_EVIDENCIAS,
  listarEvidencias,
  pendenciasDeConclusao,
  registrarEvidencia,
  urlAssinada,
} from "../../src/features/execution/evidence-service";
import { BYTES_MAXIMOS_SAIDA } from "../../src/features/execution/image-compression";
import { executarComando } from "../../src/features/tasks/task-service";
import { criarIdentidadesDeTeste, identidadePorUsuario } from "../fixtures/identities";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fixtures = criarIdentidadesDeTeste();
const [mercearia, acougue] = fixtures.setores;
const funcionario = identidadePorUsuario("funcionario.teste");
const funcionarioOutroSetor = identidadePorUsuario("funcionario.outro");

const OCORRENCIA_COM_FOTO = "50000000-0000-4000-8000-000000000021";
const OCORRENCIA_COM_CHECKLIST = "50000000-0000-4000-8000-000000000022";
const OCORRENCIA_OUTRO_SETOR = "50000000-0000-4000-8000-000000000023";

const EXECUCAO_COM_FOTO = "60000000-0000-4000-8000-000000000021";
const EXECUCAO_COM_CHECKLIST = "60000000-0000-4000-8000-000000000022";
const EXECUCAO_OUTRO_SETOR = "60000000-0000-4000-8000-000000000023";

const T0 = new Date("2026-09-01T08:00:00.000Z");
const T1 = new Date("2026-09-01T08:20:00.000Z");

function conteudoWebp(bytes = 64): Uint8Array {
  const dados = new Uint8Array(bytes);
  dados.set([0x52, 0x49, 0x46, 0x46], 0);
  return dados;
}

let admin: SupabaseClient;
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

async function limparEvidencias(): Promise<void> {
  const { data } = await admin.from("evidence").select("caminho");

  if (data && data.length > 0) {
    await admin.storage.from(BUCKET_EVIDENCIAS).remove(data.map((linha) => linha.caminho));
  }

  await admin.from("evidence").delete().not("id", "is", null);
}

async function limpar(): Promise<void> {
  await limparEvidencias();
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
      id: OCORRENCIA_COM_FOTO,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Repor gondola com foto",
      publico: "pessoa",
      exige_foto: true,
      fotos_minimas: 2,
      exige_checklist: false,
      exige_observacao: false,
    },
    {
      id: OCORRENCIA_COM_CHECKLIST,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      titulo: "Conferencia com checklist",
      publico: "pessoa",
      exige_foto: false,
      fotos_minimas: 0,
      exige_checklist: true,
      exige_observacao: true,
    },
    {
      id: OCORRENCIA_OUTRO_SETOR,
      store_id: fixtures.loja.id,
      sector_id: acougue.id,
      titulo: "Tarefa do acougue",
      publico: "pessoa",
      exige_foto: false,
      fotos_minimas: 0,
      exige_checklist: false,
      exige_observacao: false,
    },
  ]);

  await admin.from("task_recipients").insert([
    { occurrence_id: OCORRENCIA_COM_FOTO, profile_id: funcionario.perfilId },
    { occurrence_id: OCORRENCIA_COM_CHECKLIST, profile_id: funcionario.perfilId },
    { occurrence_id: OCORRENCIA_OUTRO_SETOR, profile_id: funcionarioOutroSetor.perfilId },
  ]);

  await admin.from("task_executions").insert([
    {
      id: EXECUCAO_COM_FOTO,
      occurrence_id: OCORRENCIA_COM_FOTO,
      store_id: fixtures.loja.id,
      sector_id: mercearia.id,
      responsavel_perfil_id: funcionario.perfilId,
      compartilhada: false,
    },
    {
      id: EXECUCAO_COM_CHECKLIST,
      occurrence_id: OCORRENCIA_COM_CHECKLIST,
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

  await admin.from("checklist_items").insert([
    { execution_id: EXECUCAO_COM_CHECKLIST, ordem: 0, descricao: "Conferir validade", obrigatorio: true },
    { execution_id: EXECUCAO_COM_CHECKLIST, ordem: 1, descricao: "Anotar sobras", obrigatorio: false },
  ]);
}

async function reiniciarExecucoes(): Promise<void> {
  await limparEvidencias();
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin
    .from("checklist_items")
    .update({ concluido: false, concluido_em: null })
    .not("id", "is", null);
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
      observacao: null,
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

  clienteFuncionario = await autenticar(funcionario.email, funcionario.senha);
  clienteOutroSetor = await autenticar(funcionarioOutroSetor.email, funcionarioOutroSetor.senha);
}, 90_000);

beforeEach(async () => {
  await reiniciarExecucoes();
}, 60_000);

afterAll(async () => {
  await limpar();
}, 60_000);

describe("upload de evidencia", () => {
  it("grava WebP privado e associa a evidencia a execucao correta", async () => {
    const resultado = await registrarEvidencia(clienteFuncionario, {
      execucaoId: EXECUCAO_COM_FOTO,
      lojaId: fixtures.loja.id,
      conteudo: conteudoWebp(),
      bytes: 64,
      tipo: "image/webp",
      largura: 1920,
      altura: 1080,
    });

    if (resultado.situacao !== "ok") {
      throw new Error(`Esperava upload, recebeu: ${resultado.motivo}`);
    }

    expect(resultado.evidencia.caminho.startsWith(`${EXECUCAO_COM_FOTO}/`)).toBe(true);
    expect(resultado.evidencia.bytes).toBe(64);

    const lista = await listarEvidencias(clienteFuncionario, EXECUCAO_COM_FOTO);
    expect(lista.map((item) => item.id)).toEqual([resultado.evidencia.id]);
  }, 60_000);

  it("recusa arquivo acima de 2 MB e formato diferente de WebP", async () => {
    const grande = await registrarEvidencia(clienteFuncionario, {
      execucaoId: EXECUCAO_COM_FOTO,
      lojaId: fixtures.loja.id,
      conteudo: conteudoWebp(),
      bytes: BYTES_MAXIMOS_SAIDA + 1,
      tipo: "image/webp",
    });
    expect(grande.situacao).toBe("recusado");

    const formatoErrado = await registrarEvidencia(clienteFuncionario, {
      execucaoId: EXECUCAO_COM_FOTO,
      lojaId: fixtures.loja.id,
      conteudo: conteudoWebp(),
      bytes: 64,
      tipo: "image/png",
    });
    expect(formatoErrado.situacao).toBe("recusado");

    expect(await listarEvidencias(clienteFuncionario, EXECUCAO_COM_FOTO)).toHaveLength(0);
  }, 60_000);

  it("nao deixa outra pessoa enviar nem ler evidencia da execucao", async () => {
    const invasao = await registrarEvidencia(clienteOutroSetor, {
      execucaoId: EXECUCAO_COM_FOTO,
      lojaId: fixtures.loja.id,
      conteudo: conteudoWebp(),
      bytes: 64,
      tipo: "image/webp",
    });
    expect(invasao.situacao).toBe("recusado");

    await registrarEvidencia(clienteFuncionario, {
      execucaoId: EXECUCAO_COM_FOTO,
      lojaId: fixtures.loja.id,
      conteudo: conteudoWebp(),
      bytes: 64,
      tipo: "image/webp",
    });

    expect(await listarEvidencias(clienteOutroSetor, EXECUCAO_COM_FOTO)).toHaveLength(0);
  }, 60_000);

  it("entrega a foto apenas por URL assinada, nunca por endereco publico", async () => {
    const enviada = await registrarEvidencia(clienteFuncionario, {
      execucaoId: EXECUCAO_COM_FOTO,
      lojaId: fixtures.loja.id,
      conteudo: conteudoWebp(),
      bytes: 64,
      tipo: "image/webp",
    });

    if (enviada.situacao !== "ok") throw new Error("esperava upload");

    const publica = `${url}/storage/v1/object/public/${BUCKET_EVIDENCIAS}/${enviada.evidencia.caminho}`;
    const respostaPublica = await fetch(publica);
    expect(respostaPublica.ok).toBe(false);

    const assinada = await urlAssinada(clienteFuncionario, enviada.evidencia.caminho);
    expect(assinada).toBeTruthy();

    const respostaAssinada = await fetch(assinada!);
    expect(respostaAssinada.ok).toBe(true);
  }, 60_000);
});

describe("requisitos de conclusao", () => {
  it("impede concluir enquanto faltam fotos e libera quando o minimo e atingido", async () => {
    await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_FOTO, comando: "iniciar" },
      T0,
    );

    expect(await pendenciasDeConclusao(clienteFuncionario, EXECUCAO_COM_FOTO)).toEqual(["fotos"]);

    const semFotoSuficiente = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_FOTO, comando: "concluir" },
      T1,
    );
    expect(semFotoSuficiente.situacao).toBe("recusado");

    for (let envio = 0; envio < 2; envio += 1) {
      const resultado = await registrarEvidencia(clienteFuncionario, {
        execucaoId: EXECUCAO_COM_FOTO,
        lojaId: fixtures.loja.id,
        conteudo: conteudoWebp(),
        bytes: 64,
        tipo: "image/webp",
      });
      expect(resultado.situacao).toBe("ok");
    }

    expect(await pendenciasDeConclusao(clienteFuncionario, EXECUCAO_COM_FOTO)).toEqual([]);

    const conclusao = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_FOTO, comando: "concluir" },
      T1,
    );

    if (conclusao.situacao !== "ok") {
      throw new Error(`Esperava conclusao, recebeu ${conclusao.situacao}`);
    }
    expect(conclusao.execucao.estado).toBe("concluida");
  }, 90_000);

  it("impede concluir com checklist obrigatorio aberto ou observacao ausente", async () => {
    await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_CHECKLIST, comando: "iniciar" },
      T0,
    );

    expect(
      (await pendenciasDeConclusao(clienteFuncionario, EXECUCAO_COM_CHECKLIST)).sort(),
    ).toEqual(["checklist", "observacao"]);

    await clienteFuncionario
      .from("checklist_items")
      .update({ concluido: true, concluido_em: new Date().toISOString() })
      .eq("execution_id", EXECUCAO_COM_CHECKLIST)
      .eq("obrigatorio", true);

    expect(await pendenciasDeConclusao(clienteFuncionario, EXECUCAO_COM_CHECKLIST)).toEqual([
      "observacao",
    ]);

    const semObservacao = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_CHECKLIST, comando: "concluir" },
      T1,
    );
    expect(semObservacao.situacao).toBe("recusado");

    await clienteFuncionario
      .from("task_executions")
      .update({ observacao: "Gondola conferida e reposta" })
      .eq("id", EXECUCAO_COM_CHECKLIST);

    const conclusao = await executarComando(
      clienteFuncionario,
      { execucaoId: EXECUCAO_COM_CHECKLIST, comando: "concluir" },
      T1,
    );

    if (conclusao.situacao !== "ok") {
      throw new Error(`Esperava conclusao, recebeu ${conclusao.situacao}`);
    }
    expect(conclusao.execucao.estado).toBe("concluida");
  }, 90_000);

  it("nao exige nada de uma tarefa sem requisitos", async () => {
    expect(await pendenciasDeConclusao(clienteOutroSetor, EXECUCAO_OUTRO_SETOR)).toEqual([]);
  }, 60_000);
});
