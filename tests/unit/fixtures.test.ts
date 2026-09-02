import { describe, expect, it } from "vitest";

import { criarIdentidadesDeTeste, identidadePorUsuario } from "../fixtures/identities";

describe("fixtures de identidades", () => {
  it("cria gestor, lider e funcionarios isolados na mesma loja de teste", () => {
    const fixtures = criarIdentidadesDeTeste();

    expect(fixtures.loja.nome).toBe("Loja de teste");
    expect(fixtures.setores.map((setor) => setor.nome)).toEqual(["Mercearia", "Acougue"]);
    expect(fixtures.identidades.map((identidade) => identidade.papel)).toEqual([
      "gestor",
      "lider",
      "funcionario",
      "funcionario",
    ]);
    expect(new Set(fixtures.identidades.map((identidade) => identidade.authUserId))).toHaveLength(4);
    expect(
      fixtures.identidades.every(
        (identidade) => identidade.lojaId === fixtures.loja.id && identidade.email.endsWith("@example.test"),
      ),
    ).toBe(true);
  });

  it("distribui as identidades entre os dois setores da loja", () => {
    const fixtures = criarIdentidadesDeTeste();
    const [mercearia, acougue] = fixtures.setores;

    expect(identidadePorUsuario("gestor.teste").setorId).toBeNull();
    expect(identidadePorUsuario("lider.teste").setorId).toBe(mercearia.id);
    expect(identidadePorUsuario("funcionario.teste").setorId).toBe(mercearia.id);
    expect(identidadePorUsuario("funcionario.outro").setorId).toBe(acougue.id);
  });

  it("rejeita identidade desconhecida", () => {
    expect(() => identidadePorUsuario("inexistente")).toThrow(/Identidade de teste desconhecida/);
  });
});
