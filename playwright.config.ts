import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

// Os specs que precisam limpar o Supabase remoto rodam fora do processo do
// Next, que e quem normalmente carrega o .env.local. Aqui as mesmas variaveis
// entram no processo do Playwright, sem sobrescrever o que ja veio do ambiente.
for (const [chave, valor] of Object.entries(loadEnv("development", process.cwd(), ""))) {
  process.env[chave] ??= valor;
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Varios specs semeiam e limpam o mesmo Supabase remoto. Em paralelo, a
  // limpeza de um apaga o estado do outro no meio da verificacao.
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
