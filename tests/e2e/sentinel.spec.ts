import { expect, test } from "@playwright/test";

test("abre o shell inicial", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "A operação do dia, em um só lugar.",
    }),
  ).toBeVisible();
});
