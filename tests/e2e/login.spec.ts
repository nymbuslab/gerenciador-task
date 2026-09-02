import { expect, test } from "@playwright/test";

import { preencherPin } from "./apoio";

// Cada execucao usa um identificador proprio: reaproveitar o mesmo acumularia
// tentativas entre execucoes ate disparar o bloqueio de PIN.
const DESCONHECIDO = `ninguem.${Date.now().toString(36)}`;

test("a tela de entrada recusa credenciais invalidas com mensagem neutra", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { level: 1, name: "A operação do dia, em um só lugar." }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Tipo de acesso" })).toBeVisible();

  await page.getByLabel("Usuário", { exact: true }).fill(DESCONHECIDO);
  await preencherPin(page, "000000");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  const erro = page.getByRole("alert", { name: "Erro de acesso" });
  await expect(erro).toBeVisible();
  await expect(erro).toHaveText("Usuário ou senha incorretos.");
  await expect(page).toHaveURL(/\/login$/);
});

test("a tela de entrada alterna entre acesso de funcionario e de lideranca", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("Usuário", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Dígito 1 de 6")).toBeVisible();

  await page.getByRole("button", { name: "Liderança" }).click();

  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Dígito 1 de 6")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Liderança" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
