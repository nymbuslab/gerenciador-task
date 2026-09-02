import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const GESTOR = {
  lojaNome: "Mercado do Piloto",
  gestorNome: "Carla Gestora",
  usuario: "carla.gestora",
  email: "carla.gestora@example.test",
  senha: "SenhaDoPiloto#2026",
};

let admin: SupabaseClient;

async function limpar(): Promise<void> {
  await admin.from("bootstrap_state").delete().eq("id", true);
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin.from("memberships").delete().not("id", "is", null);
  await admin.from("profiles").delete().not("id", "is", null);
  await admin.from("sectors").delete().not("id", "is", null);
  await admin.from("stores").delete().not("id", "is", null);

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const alvo = data?.users.find((usuario) => usuario.email === GESTOR.email);

  if (alvo) {
    await admin.auth.admin.deleteUser(alvo.id);
  }
}

test.beforeAll(async ({}, workerInfo) => {
  // O assistente roda uma unica vez por banco. Executar o fluxo nos dois
  // projetos ao mesmo tempo faria um deles receber a recusa pelo motivo errado,
  // entao a verificacao funcional fica no projeto de desktop.
  test.skip(
    workerInfo.project.name !== "desktop-chromium",
    "o assistente conclui uma vez por execucao",
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });
  await limpar();
});

test.afterAll(async () => {
  if (!admin) {
    return;
  }

  await limpar();
});

test("o assistente cria o primeiro gestor e depois fica indisponivel", async ({ page }) => {
  await page.goto("/configuracao-inicial");

  await expect(page.getByRole("heading", { level: 1, name: "Configuração inicial" })).toBeVisible();

  await page.getByLabel("Nome da loja").fill(GESTOR.lojaNome);
  await page.getByLabel("Nome do gestor").fill(GESTOR.gestorNome);
  await page.getByLabel("Usuário de acesso").fill(GESTOR.usuario);
  await page.getByLabel("E-mail").fill(GESTOR.email);
  await page.getByLabel("Senha").fill(GESTOR.senha);

  await page.getByRole("button", { name: "Criar loja e gestor" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Loja criada" })).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { level: 2, name: "Assistente encerrado" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar loja e gestor" })).toHaveCount(0);
});

test("o assistente recusa entrada invalida sem criar a loja", async ({ page }) => {
  await limpar();
  await page.goto("/configuracao-inicial");

  await page.getByLabel("Nome da loja").fill(GESTOR.lojaNome);
  await page.getByLabel("Nome do gestor").fill(GESTOR.gestorNome);
  await page.getByLabel("Usuário de acesso").fill("Usuario Invalido");
  await page.getByLabel("E-mail").fill(GESTOR.email);
  await page.getByLabel("Senha").fill("curta");

  await page.getByRole("button", { name: "Criar loja e gestor" }).click();

  await expect(page.getByRole("alert", { name: "Erros do formulário" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar loja e gestor" })).toBeEnabled();

  const { count } = await admin.from("stores").select("id", { count: "exact", head: true });
  expect(count).toBe(0);
});
