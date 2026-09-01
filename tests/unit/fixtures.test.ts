import { describe, expect, it } from "vitest";

import { criarIdentidadesDeTeste } from "../fixtures/identities";

describe("fixtures de identidades", () => {
  it("cria gestor, lider e funcionario isolados na mesma loja de teste", () => {
    const fixtures = criarIdentidadesDeTeste();

    expect(fixtures.loja.nome).toBe("Loja de teste");
    expect(fixtures.setores[0]?.nome).toBe("Mercearia");
    expect(fixtures.identidades.map((identidade) => identidade.papel)).toEqual([
      "gestor",
      "lider",
      "funcionario",
    ]);
    expect(new Set(fixtures.identidades.map((identidade) => identidade.authUserId))).toHaveLength(3);
    expect(
      fixtures.identidades.every(
        (identidade) => identidade.lojaId === fixtures.loja.id && identidade.email.endsWith("@example.test"),
      ),
    ).toBe(true);
  });
});
