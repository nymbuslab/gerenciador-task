import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { clienteAdministrativo, criarLojaComSetor, criarPessoa, entrar, limparLoja } from "./apoio";

const LOJA = "Mercado do Ciclo";
const SETOR = "Mercearia";
const TITULO = "Repor a gondola de bebidas";

const GESTOR = {
  nome: "Gustavo Gestor",
  usuario: "gustavo.gestor",
  email: "gustavo.gestor@example.test",
  segredo: "SenhaDoCiclo#2026",
};
const LIDER = {
  nome: "Lucia Lider",
  usuario: "lucia.lider",
  email: "lucia.lider@example.test",
  segredo: "SenhaDaLider#2026",
};
const FUNCIONARIO = {
  nome: "Fabio Funcionario",
  usuario: "fabio.funcionario",
  email: "fabio.funcionario@identidades.interno",
  segredo: "778899",
};

let admin: SupabaseClient;

test.beforeAll(async () => {
  admin = clienteAdministrativo();

  await limparLoja(admin);

  const { lojaId, setorId } = await criarLojaComSetor(admin, LOJA, SETOR);

  await criarPessoa(admin, lojaId, GESTOR, "gestor", null);
  await criarPessoa(admin, lojaId, LIDER, "lider", setorId);
  await criarPessoa(admin, lojaId, FUNCIONARIO, "funcionario", setorId);
});

test.afterAll(async () => {
  if (admin) {
    await limparLoja(admin);
  }
});

test("gestor cria, funcionario executa e lider valida a mesma tarefa", async ({ browser }) => {
  // Gestor cria a tarefa para o setor, exigindo validacao da lideranca.
  const paginaDoGestor = await entrar(browser, GESTOR.email, GESTOR.segredo, true);

  await expect(paginaDoGestor).toHaveURL(/\/operacao$/);
  await expect(paginaDoGestor.getByRole("heading", { level: 1, name: "A loja hoje" })).toBeVisible();

  // Criar tarefa agora vive atras de uma acao no cabecalho: a operacao aparece
  // primeiro, e o formulario so ocupa a tela quando alguem vai criar.
  await paginaDoGestor.getByRole("button", { name: "Criar tarefa" }).click();

  await paginaDoGestor.getByLabel("Título da tarefa").fill(TITULO);
  await paginaDoGestor.getByLabel("Instruções").fill("Comece pelo corredor central");
  await paginaDoGestor.getByLabel("Setor", { exact: true }).selectOption({ label: SETOR });
  await paginaDoGestor.getByLabel("Exigir validação da liderança").check();
  await paginaDoGestor.getByRole("button", { name: "Criar tarefa" }).click();

  await expect(paginaDoGestor.getByText(/Tarefa criada para \d+ pessoa/)).toBeVisible();
  await expect(paginaDoGestor.getByRole("cell", { name: TITULO }).first()).toBeVisible();

  // Funcionario executa no Meu dia.
  const paginaDoFuncionario = await entrar(browser, FUNCIONARIO.usuario, FUNCIONARIO.segredo, false);

  await expect(paginaDoFuncionario).toHaveURL(/\/hoje$/);
  await expect(paginaDoFuncionario.getByRole("heading", { level: 1 })).toHaveText(/de 1 feitas/);

  const cartao = paginaDoFuncionario.getByRole("article", { name: TITULO });
  await expect(cartao).toBeVisible();
  await expect(cartao.getByText("A fazer")).toBeVisible();
  await expect(paginaDoFuncionario.getByRole("heading", { level: 2, name: "Agora" })).toBeVisible();

  await paginaDoFuncionario.getByRole("button", { name: `Iniciar ${TITULO}` }).click();
  await expect(cartao.getByText("Em andamento")).toBeVisible();

  await paginaDoFuncionario.getByRole("button", { name: `Concluir ${TITULO}` }).click();
  await expect(cartao.getByText("Aguardando validação")).toBeVisible();

  // Lider valida no Setor.
  const paginaDoLider = await entrar(browser, LIDER.email, LIDER.segredo, true);

  await expect(paginaDoLider).toHaveURL(/\/setor$/);

  const aprovar = paginaDoLider.getByRole("button", { name: `Aprovar ${TITULO}` });
  await expect(aprovar).toBeVisible();
  await aprovar.click();

  await expect(paginaDoLider.getByText(/aprovar feito/)).toBeVisible();

  // O historico registra o ciclo inteiro, na ordem em que aconteceu.
  const { data: eventos } = await admin
    .from("audit_events")
    .select("acao")
    .order("created_at");

  const acoes = (eventos ?? []).map((evento) => evento.acao);
  expect(acoes).toContain("tarefa_criada");
  expect(acoes).toContain("execucao_iniciar");
  expect(acoes).toContain("execucao_concluir");
  expect(acoes).toContain("execucao_aprovar");

  const { data: execucao } = await admin
    .from("task_executions")
    .select("estado, segundos_ativos")
    .not("responsavel_perfil_id", "is", null)
    .eq("estado", "concluida")
    .single();

  expect(execucao?.estado).toBe("concluida");

  // O funcionario recebeu o aviso da aprovacao na caixa de entrada.
  const { data: avisos } = await admin.from("notifications").select("tipo");
  expect(avisos?.map((aviso) => aviso.tipo)).toContain("validacao_aprovar");

  await paginaDoGestor.context().close();
  await paginaDoFuncionario.context().close();
  await paginaDoLider.context().close();
});
