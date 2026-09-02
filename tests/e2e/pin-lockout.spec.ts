import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { preencherPin } from "./apoio";

const MAXIMO_TENTATIVAS = 5;
const IDENTIFICADOR = `bloqueio.${Date.now().toString(36)}`;

let admin: SupabaseClient;

test.beforeAll(async ({}, workerInfo) => {
  // Um unico projeto executa o bloqueio: os dois somando tentativas no mesmo
  // identificador tornariam a contagem imprevisivel.
  test.skip(
    workerInfo.project.name !== "desktop-chromium",
    "a contagem de tentativas roda uma vez por execucao",
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });
  await admin.from("pin_attempts").delete().eq("identificador", IDENTIFICADOR);
});

test.afterAll(async () => {
  if (!admin) {
    return;
  }

  await admin.from("pin_attempts").delete().eq("identificador", IDENTIFICADOR);
});

test("cinco PINs invalidos exibem bloqueio sem revelar se o usuario existe", async ({ page }) => {
  await page.goto("/");

  const usuario = page.getByLabel("Usuário", { exact: true });
  const entrar = page.getByRole("button", { name: "Entrar", exact: true });
  const erro = page.getByRole("alert", { name: "Erro de acesso" });

  for (let tentativa = 1; tentativa <= MAXIMO_TENTATIVAS; tentativa += 1) {
    await usuario.fill(IDENTIFICADOR);
    await preencherPin(page, "000000");
    await entrar.click();
    await expect(erro).toBeVisible();

    if (tentativa < MAXIMO_TENTATIVAS) {
      await expect(erro).toHaveText("Usuário ou senha incorretos.");
    }
  }

  await expect(erro).toContainText("Acesso bloqueado por tentativas inválidas.");
  await expect(erro).not.toContainText("não existe");
  await expect(erro).not.toContainText("não encontrado");

  const { data } = await admin
    .from("pin_attempts")
    .select("bloqueado_ate, profile_id")
    .eq("identificador", IDENTIFICADOR)
    .single();

  expect(data?.profile_id, "identificador desconhecido nao aponta para perfil").toBeNull();
  expect(new Date(data!.bloqueado_ate).getTime()).toBeGreaterThan(Date.now());
});
