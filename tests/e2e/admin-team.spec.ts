import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { entrar } from "./apoio";

const GESTOR = {
  lojaNome: "Mercado da Equipe",
  nome: "Diego Gestor",
  usuario: "diego.gestor",
  email: "diego.gestor@example.test",
  senha: "SenhaDaEquipe#2026",
};

const SETOR_INICIAL = "Mercearia";
const SETOR_NOVO = "Padaria";
const FUNCIONARIO = { nome: "Eva Reposicao", usuario: "eva.reposicao", pin: "112233" };
const PIN_REDEFINIDO = "445566";

let admin: SupabaseClient;
let lojaId: string;
let setorInicialId: string;

async function limpar(): Promise<void> {
  await admin.from("pin_attempts").delete().not("identificador", "is", null);
  await admin.from("bootstrap_state").delete().eq("id", true);
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin.from("memberships").delete().not("id", "is", null);
  await admin.from("profiles").delete().not("id", "is", null);
  await admin.from("sectors").delete().not("id", "is", null);
  await admin.from("stores").delete().not("id", "is", null);

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });

  for (const conta of data?.users ?? []) {
    if (conta.email?.endsWith("@example.test") || conta.email?.endsWith("@identidades.interno")) {
      await admin.auth.admin.deleteUser(conta.id);
    }
  }
}

async function semear(): Promise<void> {
  const { data: loja } = await admin
    .from("stores")
    .insert({ nome: GESTOR.lojaNome })
    .select("id")
    .single();
  lojaId = loja!.id;

  const { data: setor } = await admin
    .from("sectors")
    .insert({ store_id: lojaId, nome: SETOR_INICIAL })
    .select("id")
    .single();
  setorInicialId = setor!.id;

  const { data: conta } = await admin.auth.admin.createUser({
    email: GESTOR.email,
    password: GESTOR.senha,
    email_confirm: true,
  });

  const { data: perfil } = await admin
    .from("profiles")
    .insert({
      auth_user_id: conta!.user!.id,
      store_id: lojaId,
      nome: GESTOR.nome,
      usuario: GESTOR.usuario,
      email: GESTOR.email,
    })
    .select("id")
    .single();

  await admin.from("memberships").insert({
    profile_id: perfil!.id,
    store_id: lojaId,
    sector_id: null,
    papel: "gestor",
  });
}

test.beforeAll(async ({}, workerInfo) => {
  // O fluxo administrativo escreve na mesma loja de teste. Rodar nos dois
  // projetos ao mesmo tempo faria um sobrescrever o estado do outro.
  test.skip(
    workerInfo.project.name !== "desktop-chromium",
    "o fluxo administrativo roda uma vez por execucao",
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });

  await limpar();
  await semear();
});

test.afterAll(async () => {
  if (!admin) {
    return;
  }

  await limpar();
});

test("o gestor cria setor, cadastra funcionario, promove, transfere e redefine o PIN", async ({
  browser,
}) => {
  const page = await entrar(browser, GESTOR.email, GESTOR.senha, true);

  // A tela de Operacao ainda e a pagina de espera da Sprint 02, com nome fixo.
  // O que a entrada precisa provar aqui e o destino do papel e a navegacao de
  // gestor; o nome da sessao aparece nas telas administrativas abaixo.
  await expect(page).toHaveURL(/\/operacao$/);
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link"),
  ).toHaveText(["Operação", "Equipe", "Setores", "Avisos"]);

  // Cria setor
  await page.getByRole("link", { name: "Setores", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Setores" })).toBeVisible();
  await expect(page.getByText(GESTOR.nome)).toBeVisible();

  await page.getByLabel("Nome do setor").fill(SETOR_NOVO);
  await page.getByRole("button", { name: "Criar setor" }).click();
  await expect(page.getByRole("cell", { name: SETOR_NOVO, exact: true })).toBeVisible();

  // Cadastra funcionario
  await page.getByRole("link", { name: "Equipe", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Equipe" })).toBeVisible();

  await page.getByLabel("Nome", { exact: true }).fill(FUNCIONARIO.nome);
  await page.getByLabel("Usuário", { exact: true }).fill(FUNCIONARIO.usuario);
  await page.getByLabel("Setor", { exact: true }).selectOption({ label: SETOR_INICIAL });
  await page.getByLabel("PIN de seis dígitos").fill(FUNCIONARIO.pin);
  await page.getByRole("button", { name: "Cadastrar funcionário" }).click();

  await expect(page.getByText("Funcionário cadastrado.")).toBeVisible();
  await expect(page.getByRole("cell", { name: new RegExp(FUNCIONARIO.usuario) })).toBeVisible();

  // Promove a lider
  await page.getByRole("button", { name: `Promover ${FUNCIONARIO.nome} a líder` }).click();
  await expect(page.getByText("Vínculo promovido a líder de setor.")).toBeVisible();

  // Transfere de setor
  await page.getByLabel(`Setor de ${FUNCIONARIO.nome}`).selectOption({ label: SETOR_NOVO });
  await expect(page.getByText("Vínculo transferido de setor.")).toBeVisible();

  // Redefine o PIN
  await page.getByLabel(`Novo PIN de ${FUNCIONARIO.nome}`).fill(PIN_REDEFINIDO);
  await page.getByRole("button", { name: `Redefinir PIN de ${FUNCIONARIO.nome}` }).click();
  await expect(page.getByText("PIN redefinido.")).toBeVisible();

  // O banco reflete promocao, transferencia e auditoria
  const { data: perfil } = await admin
    .from("profiles")
    .select("id, memberships(papel, sector_id)")
    .eq("usuario", FUNCIONARIO.usuario)
    .single();

  const vinculo = (perfil as { memberships: { papel: string; sector_id: string }[] }).memberships[0];
  expect(vinculo.papel).toBe("lider");
  expect(vinculo.sector_id).not.toBe(setorInicialId);

  const { data: eventos } = await admin
    .from("audit_events")
    .select("acao")
    .eq("entidade_id", (perfil as { id: string }).id);

  expect(eventos?.map((evento) => evento.acao)).toContain("pin_redefinido");
});

test("um funcionario nao administra a equipe", async ({ browser }) => {
  const { data: setor } = await admin
    .from("sectors")
    .select("id")
    .eq("store_id", lojaId)
    .limit(1)
    .single();

  const { data: conta } = await admin.auth.admin.createUser({
    email: "sem.permissao@example.test",
    password: "654321",
    email_confirm: true,
  });

  const { data: perfil } = await admin
    .from("profiles")
    .insert({
      auth_user_id: conta!.user!.id,
      store_id: lojaId,
      nome: "Sem Permissao",
      usuario: "sem.permissao",
      email: "sem.permissao@example.test",
    })
    .select("id")
    .single();

  await admin.from("memberships").insert({
    profile_id: perfil!.id,
    store_id: lojaId,
    sector_id: setor!.id,
    papel: "funcionario",
  });

  const page = await entrar(browser, "sem.permissao", "654321", false);

  await expect(page).toHaveURL(/\/hoje$/);

  await page.goto("/admin/funcionarios");

  await expect(
    page.getByText("Somente o gestor cadastra pessoas, promove líder e redefine acesso."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cadastrar funcionário" })).toHaveCount(0);
});
