import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * As tres visoes por papel precisam continuar consumindo o modulo de tarefas, e
 * nao o banco. Uma pagina que monta a propria consulta escapa da RLS ja testada
 * e passa a repetir regra que o dominio tem.
 */

const PAGINAS = ["app/hoje/page.tsx", "app/setor/page.tsx", "app/operacao/page.tsx"];
const PAINEL = "src/features/tasks/components/task-board.tsx";
const SERVICO = "src/features/tasks/task-service.ts";

function fonte(caminho: string): string {
  return readFileSync(resolve(process.cwd(), caminho), "utf8");
}

function nomesImportadosDoServico(painel: string): string[] {
  const bloco = painel.match(/import\s*\{([^}]+)\}\s*from\s*"\.\.\/task-service"/);

  if (!bloco) {
    return [];
  }

  return bloco[1]
    .split(",")
    .map((nome) => nome.trim())
    .filter((nome) => nome.length > 0 && !nome.startsWith("type "));
}

describe("contrato das telas por papel", () => {
  it.each(PAGINAS)("%s não fala com o banco direto", (caminho) => {
    const conteudo = fonte(caminho);

    for (const proibido of ["@supabase", "supabaseDoNavegador", ".from(", ".rpc(", "process.env"]) {
      expect(conteudo.includes(proibido), `${caminho} não pode conter ${proibido}`).toBe(false);
    }
  });

  it.each(PAGINAS)("%s monta a visão pelo módulo de tarefas", (caminho) => {
    expect(fonte(caminho)).toContain('from "@/src/features/tasks/components/task-board"');
  });

  it("o painel usa apenas funções que o serviço de tarefas exporta", () => {
    const importados = nomesImportadosDoServico(fonte(PAINEL));
    const servico = fonte(SERVICO);

    expect(importados.length).toBeGreaterThan(0);

    for (const nome of importados) {
      expect(
        servico.includes(`export async function ${nome}(`),
        `${nome} precisa ser exportado por ${SERVICO}`,
      ).toBe(true);
    }
  });
});
