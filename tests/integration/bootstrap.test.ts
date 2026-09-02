import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  bootstrapDisponivel,
  executarBootstrap,
  type EntradaBootstrap,
} from "../../src/features/administration/bootstrap-service";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PRIMEIRO_GESTOR: EntradaBootstrap = {
  lojaNome: "Mercado do Bairro",
  gestorNome: "Ana Gestora",
  usuario: "ana.gestora",
  email: "ana.gestora@example.test",
  senha: "SenhaDeGestor#2026",
};

const SEGUNDO_GESTOR: EntradaBootstrap = {
  lojaNome: "Mercado Concorrente",
  gestorNome: "Bruno Gestor",
  usuario: "bruno.gestor",
  email: "bruno.gestor@example.test",
  senha: "OutraSenhaForte#2026",
};

let admin: SupabaseClient;

async function removerUsuario(email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const alvo = data?.users.find((usuario) => usuario.email === email);

  if (alvo) {
    await admin.auth.admin.deleteUser(alvo.id);
  }
}

async function limpar(): Promise<void> {
  await admin.from("bootstrap_state").delete().eq("id", true);
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin.from("memberships").delete().not("id", "is", null);
  await admin.from("profiles").delete().not("id", "is", null);
  await admin.from("sectors").delete().not("id", "is", null);
  await admin.from("stores").delete().not("id", "is", null);

  for (const email of [PRIMEIRO_GESTOR.email, SEGUNDO_GESTOR.email]) {
    await removerUsuario(email);
  }
}

beforeAll(() => {
  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });
});

beforeEach(async () => {
  await limpar();
}, 60_000);

afterEach(async () => {
  await limpar();
}, 60_000);

describe("assistente de configuracao inicial", () => {
  it("fica disponivel apenas enquanto nao existir loja e gestor", async () => {
    expect(await bootstrapDisponivel(admin)).toBe(true);

    const resultado = await executarBootstrap(admin, PRIMEIRO_GESTOR);
    expect(resultado.situacao).toBe("concluido");

    expect(await bootstrapDisponivel(admin)).toBe(false);
  });

  it("cria loja, perfil, vinculo de gestor e evento de auditoria em uma operacao", async () => {
    const resultado = await executarBootstrap(admin, PRIMEIRO_GESTOR);

    if (resultado.situacao !== "concluido") {
      throw new Error(`Esperava conclusao, recebeu ${resultado.situacao}`);
    }

    const { data: lojas } = await admin.from("stores").select("id, nome");
    expect(lojas).toEqual([{ id: resultado.lojaId, nome: PRIMEIRO_GESTOR.lojaNome }]);

    const { data: perfis } = await admin
      .from("profiles")
      .select("id, nome, usuario, email, store_id");
    expect(perfis).toEqual([
      {
        id: resultado.perfilId,
        nome: PRIMEIRO_GESTOR.gestorNome,
        usuario: PRIMEIRO_GESTOR.usuario,
        email: PRIMEIRO_GESTOR.email,
        store_id: resultado.lojaId,
      },
    ]);

    const { data: vinculos } = await admin
      .from("memberships")
      .select("profile_id, papel, sector_id, ativo");
    expect(vinculos).toEqual([
      {
        profile_id: resultado.perfilId,
        papel: "gestor",
        sector_id: null,
        ativo: true,
      },
    ]);

    const { data: eventos } = await admin
      .from("audit_events")
      .select("acao, entidade, entidade_id, store_id");
    expect(eventos).toEqual([
      {
        acao: "bootstrap_concluido",
        entidade: "stores",
        entidade_id: resultado.lojaId,
        store_id: resultado.lojaId,
      },
    ]);
  });

  it("permite que o gestor recem-criado autentique com a propria senha", async () => {
    const resultado = await executarBootstrap(admin, PRIMEIRO_GESTOR);
    expect(resultado.situacao).toBe("concluido");

    const cliente = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await cliente.auth.signInWithPassword({
      email: PRIMEIRO_GESTOR.email,
      password: PRIMEIRO_GESTOR.senha,
    });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();

    const { data: loja } = await cliente.from("stores").select("nome");
    expect(loja).toEqual([{ nome: PRIMEIRO_GESTOR.lojaNome }]);

    await cliente.auth.signOut();
  });

  it("duas solicitacoes concorrentes criam exatamente uma loja e um gestor", async () => {
    const [primeiro, segundo] = await Promise.all([
      executarBootstrap(admin, PRIMEIRO_GESTOR),
      executarBootstrap(admin, SEGUNDO_GESTOR),
    ]);

    const situacoes = [primeiro.situacao, segundo.situacao].sort();
    expect(situacoes).toEqual(["concluido", "indisponivel"]);

    const { count: lojas } = await admin
      .from("stores")
      .select("id", { count: "exact", head: true });
    expect(lojas).toBe(1);

    const { count: perfis } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    expect(perfis).toBe(1);

    const { data: usuarios } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const criados = usuarios?.users.filter((usuario) =>
      [PRIMEIRO_GESTOR.email, SEGUNDO_GESTOR.email].includes(usuario.email ?? ""),
    );
    expect(criados).toHaveLength(1);
  }, 60_000);

  it("recusa a solicitacao posterior sem revelar dados da loja existente", async () => {
    await executarBootstrap(admin, PRIMEIRO_GESTOR);

    const posterior = await executarBootstrap(admin, SEGUNDO_GESTOR);
    expect(posterior).toEqual({ situacao: "indisponivel" });

    const { data: lojas } = await admin.from("stores").select("nome");
    expect(lojas).toEqual([{ nome: PRIMEIRO_GESTOR.lojaNome }]);
  });

  it("rejeita entrada invalida antes de tocar no banco", async () => {
    const resultado = await executarBootstrap(admin, {
      ...PRIMEIRO_GESTOR,
      usuario: "AA",
      senha: "curta",
    });

    expect(resultado.situacao).toBe("invalido");
    if (resultado.situacao !== "invalido") {
      throw new Error("Esperava resultado invalido");
    }
    expect(resultado.motivos.length).toBeGreaterThan(0);

    expect(await bootstrapDisponivel(admin)).toBe(true);

    const { count } = await admin.from("stores").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });
});
