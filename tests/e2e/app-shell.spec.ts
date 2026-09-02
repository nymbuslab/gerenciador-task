import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  clienteAdministrativo,
  criarLojaComSetor,
  criarPessoa,
  entrar,
  limparLoja,
} from "./apoio";

/**
 * O shell so existe para quem tem sessao, entao cada papel entra de verdade
 * antes de conferir os proprios destinos. Rodar nos dois projetos cobre a
 * equivalencia exigida entre celular e desktop.
 */

const LOJA = "Mercado do Shell";
const SETOR = "Mercearia";

const GESTOR = {
  nome: "Gilda Gestora",
  usuario: "gilda.gestora",
  email: "gilda.gestora@example.test",
  segredo: "SenhaDoShell#2026",
};
const LIDER = {
  nome: "Leo Lider",
  usuario: "leo.lider",
  email: "leo.lider@example.test",
  segredo: "SenhaDoLider#2026",
};
const FUNCIONARIO = {
  nome: "Fatima Funcionaria",
  usuario: "fatima.funcionaria",
  email: "fatima.funcionaria@identidades.interno",
  segredo: "334455",
};

const CENARIOS = [
  {
    papel: "funcionário",
    pessoa: FUNCIONARIO,
    lideranca: false,
    rota: /\/hoje$/,
    destinos: ["Meu dia", "Avisos"],
    atual: "Meu dia",
  },
  {
    papel: "líder",
    pessoa: LIDER,
    lideranca: true,
    rota: /\/setor$/,
    destinos: ["Meu dia", "Setor", "Avisos"],
    atual: "Setor",
  },
  {
    papel: "gestor",
    pessoa: GESTOR,
    lideranca: true,
    rota: /\/operacao$/,
    destinos: ["Operação", "Equipe", "Setores", "Avisos"],
    atual: "Operação",
  },
];

const TODOS_OS_DESTINOS = ["Meu dia", "Setor", "Operação", "Equipe", "Setores", "Avisos"];

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

for (const cenario of CENARIOS) {
  test(`o ${cenario.papel} vê somente os próprios destinos`, async ({ browser }) => {
    const pagina = await entrar(
      browser,
      cenario.lideranca ? cenario.pessoa.email : cenario.pessoa.usuario,
      cenario.pessoa.segredo,
      cenario.lideranca,
    );

    await expect(pagina).toHaveURL(cenario.rota);

    const navegacao = pagina.getByRole("navigation", { name: "Navegação principal" });
    await expect(navegacao).toBeVisible();
    await expect(navegacao.getByRole("link")).toHaveText(cenario.destinos);

    for (const negado of TODOS_OS_DESTINOS.filter((item) => !cenario.destinos.includes(item))) {
      await expect(navegacao.getByRole("link", { name: negado, exact: true })).toHaveCount(0);
    }

    await expect(
      navegacao.getByRole("link", { name: cenario.atual, exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await expect(pagina.getByText(cenario.pessoa.nome)).toBeVisible();

    await pagina.context().close();
  });
}

test("os destinos respeitam o alvo mínimo de toque", async ({ browser }) => {
  const pagina = await entrar(browser, LIDER.email, LIDER.segredo, true);

  const destinos = pagina
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link");

  await expect(destinos.first()).toBeVisible();

  for (const destino of await destinos.all()) {
    const caixa = await destino.boundingBox();

    expect(caixa).not.toBeNull();
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    expect(caixa!.width).toBeGreaterThanOrEqual(44);
  }

  await pagina.context().close();
});

test("a navegação ancora embaixo no celular e no topo no desktop", async ({ browser }, testInfo) => {
  const pagina = await entrar(browser, LIDER.email, LIDER.segredo, true);

  const navegacao = pagina.getByRole("navigation", { name: "Navegação principal" });
  await expect(navegacao).toBeVisible();

  const caixa = await navegacao.boundingBox();
  const viewport = pagina.viewportSize();

  expect(caixa).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (testInfo.project.name === "mobile-chromium") {
    expect(caixa!.y + caixa!.height).toBeCloseTo(viewport!.height, 0);
  } else {
    expect(caixa!.y).toBeLessThan(200);
  }

  await pagina.context().close();
});
