import { expect, test } from "@playwright/test";

/**
 * A raiz e a entrada: quem abre o app quer digitar o acesso, nao ler uma
 * apresentacao. O convite para configurar a loja aparece so enquanto ela nao
 * existe, e este spec roda com a loja ja criada pelos demais.
 */
test("a raiz e a tela de entrada", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "A operação do dia, em um só lugar." }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Tipo de acesso" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});
