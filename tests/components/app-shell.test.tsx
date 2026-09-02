import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/src/components/app-shell";
import { destinosDoPapel, type Papel } from "@/src/components/navigation";

const DESTINOS_ESPERADOS: Record<Papel, string[]> = {
  funcionario: ["Meu dia", "Avisos"],
  lider: ["Meu dia", "Setor", "Avisos"],
  gestor: ["Operação", "Equipe", "Setores", "Avisos"],
};

const TODOS_OS_ROTULOS = ["Meu dia", "Setor", "Operação", "Equipe", "Setores", "Avisos"];

function navegacao() {
  return screen.getByRole("navigation", { name: "Navegação principal" });
}

describe("destinos de navegação por papel", () => {
  it("entrega ao funcionário o próprio dia e a caixa de entrada", () => {
    expect(destinosDoPapel("funcionario").map((destino) => destino.rotulo)).toEqual(
      DESTINOS_ESPERADOS.funcionario,
    );
  });

  it("entrega ao líder o próprio dia, o setor e a caixa de entrada", () => {
    expect(destinosDoPapel("lider").map((destino) => destino.rotulo)).toEqual(
      DESTINOS_ESPERADOS.lider,
    );
  });

  it("entrega ao gestor a operação e a administração", () => {
    expect(destinosDoPapel("gestor").map((destino) => destino.rotulo)).toEqual(
      DESTINOS_ESPERADOS.gestor,
    );
  });
});

describe("shell responsivo por papel", () => {
  it.each(Object.keys(DESTINOS_ESPERADOS) as Papel[])(
    "mostra a %s somente os destinos autorizados",
    (papel) => {
      render(
        <AppShell papel={papel} rotaAtual={destinosDoPapel(papel)[0].rota} nomeUsuario="Pessoa Teste">
          <h1>Conteúdo</h1>
        </AppShell>,
      );

      const links = within(navegacao()).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual(DESTINOS_ESPERADOS[papel]);

      const negados = TODOS_OS_ROTULOS.filter(
        (rotulo) => !DESTINOS_ESPERADOS[papel].includes(rotulo),
      );

      for (const rotulo of negados) {
        expect(within(navegacao()).queryByRole("link", { name: rotulo })).toBeNull();
      }
    },
  );

  it("marca a rota atual sem depender apenas de cor", () => {
    render(
      <AppShell papel="lider" rotaAtual="/setor" nomeUsuario="Lider Teste">
        <h1>Conteúdo</h1>
      </AppShell>,
    );

    const atual = within(navegacao()).getByRole("link", { name: "Setor" });
    expect(atual).toHaveAttribute("aria-current", "page");

    const outro = within(navegacao()).getByRole("link", { name: "Meu dia" });
    expect(outro).not.toHaveAttribute("aria-current");
  });

  it("anuncia o papel de quem está na sessão e rende o conteúdo recebido", () => {
    render(
      <AppShell papel="gestor" rotaAtual="/operacao" nomeUsuario="Gestor Teste">
        <h1>Painel</h1>
      </AppShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
    expect(screen.getByText("Gestor Teste")).toBeVisible();
    expect(screen.getByText("Gestor")).toBeVisible();
  });

  it("aceita rota fora dos destinos do papel sem marcar item algum", () => {
    render(
      <AppShell papel="funcionario" rotaAtual="/rota-desconhecida" nomeUsuario="Funcionario Teste">
        <h1>Conteúdo</h1>
      </AppShell>,
    );

    const links = within(navegacao()).getAllByRole("link");
    expect(links.some((link) => link.getAttribute("aria-current") === "page")).toBe(false);
  });
});

describe("isolamento do shell", () => {
  const fontes = ["src/components/app-shell.tsx", "src/components/navigation.tsx"];

  it.each(fontes)("%s não importa infraestrutura de banco nem segredos", (caminho) => {
    const fonte = readFileSync(resolve(process.cwd(), caminho), "utf8");

    expect(fonte).not.toMatch(/@supabase/);
    expect(fonte).not.toMatch(/process\.env/);
    expect(fonte).not.toMatch(/lib\/env/);
    expect(fonte).not.toMatch(/createClient/);
  });
});
