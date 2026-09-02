import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Estado } from "@/src/components/app-shell";

/**
 * Sentinela do harness de componentes, criada na T-01.02. Ela apontava para a
 * raiz, que deixou de ser uma tela estática e virou a entrada, com roteador e
 * consulta ao servidor. Agora aponta para um componente de apresentação puro:
 * o que esta sentinela precisa provar é que renderizar e consultar por papel
 * acessível funciona, e não o comportamento de uma página.
 */
describe("harness de componentes", () => {
  it("renderiza um componente do produto com papel acessível", () => {
    render(
      <Estado
        titulo="Nada em aberto"
        texto="Quando a liderança atribuir uma tarefa a você, ela aparece aqui."
      />,
    );

    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Nada em aberto" })).toBeVisible();
  });
});
