import { describe, expect, it } from "vitest";

import {
  BYTES_MAXIMOS_ENTRADA,
  BYTES_MAXIMOS_SAIDA,
  dimensoesAlvo,
  FOTOS_MAXIMAS,
  FOTOS_MINIMAS,
  LADO_MAXIMO,
  validarEntrada,
  validarQuantidade,
  validarSaida,
} from "@/src/features/execution/image-compression";

describe("tipos e limites de entrada", () => {
  it("aceita JPEG, PNG e WebP dentro de 10 MB", () => {
    for (const tipo of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validarEntrada({ tipo, bytes: 9_000_000 })).toEqual({ situacao: "ok" });
    }
  });

  it("recusa formato fora da lista", () => {
    const resultado = validarEntrada({ tipo: "image/gif", bytes: 1_000 });

    expect(resultado.situacao).toBe("recusado");
  });

  it("recusa arquivo acima de 10 MB", () => {
    expect(validarEntrada({ tipo: "image/jpeg", bytes: BYTES_MAXIMOS_ENTRADA + 1 }).situacao).toBe(
      "recusado",
    );
    expect(validarEntrada({ tipo: "image/jpeg", bytes: BYTES_MAXIMOS_ENTRADA }).situacao).toBe("ok");
  });

  it("recusa arquivo vazio", () => {
    expect(validarEntrada({ tipo: "image/png", bytes: 0 }).situacao).toBe("recusado");
  });
});

describe("limites de saida", () => {
  it("exige WebP de no maximo 2 MB", () => {
    expect(validarSaida({ tipo: "image/webp", bytes: BYTES_MAXIMOS_SAIDA }).situacao).toBe("ok");
    expect(validarSaida({ tipo: "image/webp", bytes: BYTES_MAXIMOS_SAIDA + 1 }).situacao).toBe(
      "recusado",
    );
    expect(validarSaida({ tipo: "image/png", bytes: 1_000 }).situacao).toBe("recusado");
  });
});

describe("reducao de dimensoes", () => {
  it("mantem imagem que ja cabe no lado maximo", () => {
    expect(dimensoesAlvo(1200, 800)).toEqual({ largura: 1200, altura: 800 });
  });

  it("reduz o lado maior para 1920 preservando a proporcao", () => {
    expect(dimensoesAlvo(3840, 2160)).toEqual({ largura: LADO_MAXIMO, altura: 1080 });
    expect(dimensoesAlvo(2160, 3840)).toEqual({ largura: 1080, altura: LADO_MAXIMO });
  });

  it("nunca devolve dimensao menor que um pixel", () => {
    const alvo = dimensoesAlvo(4000, 1);

    expect(alvo.largura).toBe(LADO_MAXIMO);
    expect(alvo.altura).toBeGreaterThanOrEqual(1);
  });
});

describe("quantidade de fotos exigida", () => {
  it("aceita de uma a cinco fotos", () => {
    for (let exigidas = FOTOS_MINIMAS; exigidas <= FOTOS_MAXIMAS; exigidas += 1) {
      expect(validarQuantidade(exigidas, exigidas).situacao).toBe("ok");
    }
  });

  it("recusa quando faltam fotos", () => {
    expect(validarQuantidade(3, 2).situacao).toBe("recusado");
  });

  it("recusa quando passa do teto de cinco", () => {
    expect(validarQuantidade(1, FOTOS_MAXIMAS + 1).situacao).toBe("recusado");
  });

  it("dispensa fotos quando a tarefa nao exige", () => {
    expect(validarQuantidade(0, 0).situacao).toBe("ok");
  });
});
