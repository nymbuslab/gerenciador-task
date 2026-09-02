import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  criarIdentidadesDeTeste,
  identidadePorUsuario,
  type IdentidadeTeste,
} from "../fixtures/identities";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fixtures = criarIdentidadesDeTeste();
const [mercearia, acougue] = fixtures.setores;

const gestor = identidadePorUsuario("gestor.teste");
const lider = identidadePorUsuario("lider.teste");
const funcionario = identidadePorUsuario("funcionario.teste");
const funcionarioOutroSetor = identidadePorUsuario("funcionario.outro");

const CODIGO_PERMISSAO_NEGADA = "42501";

let admin: SupabaseClient;
let clienteGestor: SupabaseClient;
let clienteLider: SupabaseClient;
let clienteFuncionario: SupabaseClient;
let clienteFuncionarioOutroSetor: SupabaseClient;
let clienteAnonimo: SupabaseClient;

function clienteAnonimoNovo(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false } });
}

async function autenticar(identidade: IdentidadeTeste): Promise<SupabaseClient> {
  const cliente = clienteAnonimoNovo();
  const { error } = await cliente.auth.signInWithPassword({
    email: identidade.email,
    password: identidade.senha,
  });

  if (error) {
    throw new Error(`Falha ao autenticar ${identidade.usuario}: ${error.message}`);
  }

  return cliente;
}

async function limpar(): Promise<void> {
  await admin.from("memberships").delete().eq("store_id", fixtures.loja.id);
  await admin.from("profiles").delete().eq("store_id", fixtures.loja.id);
  await admin.from("sectors").delete().eq("store_id", fixtures.loja.id);
  await admin.from("stores").delete().eq("id", fixtures.loja.id);

  for (const identidade of fixtures.identidades) {
    await admin.auth.admin.deleteUser(identidade.authUserId).catch(() => undefined);
  }
}

async function semear(): Promise<void> {
  const { error: erroLoja } = await admin
    .from("stores")
    .insert({ id: fixtures.loja.id, nome: fixtures.loja.nome });
  expect(erroLoja, "insercao da loja").toBeNull();

  const { error: erroSetores } = await admin.from("sectors").insert(
    fixtures.setores.map((setor) => ({
      id: setor.id,
      store_id: setor.lojaId,
      nome: setor.nome,
    })),
  );
  expect(erroSetores, "insercao dos setores").toBeNull();

  for (const identidade of fixtures.identidades) {
    const { error } = await admin.auth.admin.createUser({
      id: identidade.authUserId,
      email: identidade.email,
      password: identidade.senha,
      email_confirm: true,
    });
    expect(error, `criacao do usuario ${identidade.usuario}`).toBeNull();
  }

  const { error: erroPerfis } = await admin.from("profiles").insert(
    fixtures.identidades.map((identidade) => ({
      id: identidade.perfilId,
      auth_user_id: identidade.authUserId,
      store_id: identidade.lojaId,
      nome: identidade.nome,
      usuario: identidade.usuario,
      email: identidade.email,
    })),
  );
  expect(erroPerfis, "insercao dos perfis").toBeNull();

  const { error: erroVinculos } = await admin.from("memberships").insert(
    fixtures.identidades.map((identidade) => ({
      profile_id: identidade.perfilId,
      store_id: identidade.lojaId,
      sector_id: identidade.setorId,
      papel: identidade.papel,
    })),
  );
  expect(erroVinculos, "insercao dos vinculos").toBeNull();
}

beforeAll(async () => {
  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });

  await limpar();
  await semear();

  clienteGestor = await autenticar(gestor);
  clienteLider = await autenticar(lider);
  clienteFuncionario = await autenticar(funcionario);
  clienteFuncionarioOutroSetor = await autenticar(funcionarioOutroSetor);
  clienteAnonimo = clienteAnonimoNovo();
}, 60_000);

afterAll(async () => {
  await limpar();
}, 60_000);

describe("matriz RLS de stores", () => {
  it("os tres papeis leem a propria loja", async () => {
    for (const cliente of [clienteGestor, clienteLider, clienteFuncionario]) {
      const { data, error } = await cliente.from("stores").select("id, nome");

      expect(error).toBeNull();
      expect(data).toEqual([{ id: fixtures.loja.id, nome: fixtures.loja.nome }]);
    }
  });

  it("somente o gestor renomeia a loja", async () => {
    const { data: comoGestor, error: erroGestor } = await clienteGestor
      .from("stores")
      .update({ nome: "Loja de teste renomeada" })
      .eq("id", fixtures.loja.id)
      .select("nome");

    expect(erroGestor).toBeNull();
    expect(comoGestor).toEqual([{ nome: "Loja de teste renomeada" }]);

    for (const cliente of [clienteLider, clienteFuncionario]) {
      const { data, error } = await cliente
        .from("stores")
        .update({ nome: "Loja invadida" })
        .eq("id", fixtures.loja.id)
        .select("nome");

      expect(error).toBeNull();
      expect(data).toEqual([]);
    }

    await clienteGestor
      .from("stores")
      .update({ nome: fixtures.loja.nome })
      .eq("id", fixtures.loja.id);
  });
});

describe("matriz RLS de sectors", () => {
  it("o gestor le todos os setores da loja", async () => {
    const { data, error } = await clienteGestor.from("sectors").select("id");

    expect(error).toBeNull();
    expect(data?.map((setor) => setor.id).sort()).toEqual([mercearia.id, acougue.id].sort());
  });

  it("o lider le apenas o proprio setor e recebe negacao ao consultar outro setor", async () => {
    const { data: proprio, error: erroProprio } = await clienteLider
      .from("sectors")
      .select("id, nome")
      .eq("id", mercearia.id);

    expect(erroProprio).toBeNull();
    expect(proprio).toEqual([{ id: mercearia.id, nome: mercearia.nome }]);

    const { data: alheio, error: erroAlheio } = await clienteLider
      .from("sectors")
      .select("id, nome")
      .eq("id", acougue.id);

    expect(erroAlheio).toBeNull();
    expect(alheio).toEqual([]);

    const { data: todos } = await clienteLider.from("sectors").select("id");
    expect(todos).toEqual([{ id: mercearia.id }]);
  });

  it("o funcionario le apenas o proprio setor", async () => {
    const { data, error } = await clienteFuncionario.from("sectors").select("id");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: mercearia.id }]);

    const { data: outro } = await clienteFuncionarioOutroSetor.from("sectors").select("id");
    expect(outro).toEqual([{ id: acougue.id }]);
  });

  it("somente o gestor cria e arquiva setores", async () => {
    const novoSetorId = "20000000-0000-4000-8000-000000000009";

    const { error: erroLider } = await clienteLider
      .from("sectors")
      .insert({ id: novoSetorId, store_id: fixtures.loja.id, nome: "Padaria" });
    expect(erroLider?.code).toBe(CODIGO_PERMISSAO_NEGADA);

    const { data: arquivamentoLider, error: erroArquivamento } = await clienteLider
      .from("sectors")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", mercearia.id)
      .select("id");
    expect(erroArquivamento).toBeNull();
    expect(arquivamentoLider).toEqual([]);

    const { error: erroGestor } = await clienteGestor
      .from("sectors")
      .insert({ id: novoSetorId, store_id: fixtures.loja.id, nome: "Padaria" });
    expect(erroGestor).toBeNull();

    await admin.from("sectors").delete().eq("id", novoSetorId);
  });
});

describe("matriz RLS de profiles", () => {
  it("o gestor le todos os perfis da loja", async () => {
    const { data, error } = await clienteGestor.from("profiles").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(fixtures.identidades.length);
  });

  it("o lider le apenas os perfis do proprio setor", async () => {
    const { data, error } = await clienteLider.from("profiles").select("usuario");

    expect(error).toBeNull();
    expect(data?.map((perfil) => perfil.usuario).sort()).toEqual(
      [lider.usuario, funcionario.usuario].sort(),
    );
  });

  it("o funcionario de outro setor nao enxerga a equipe da mercearia", async () => {
    const { data, error } = await clienteFuncionarioOutroSetor.from("profiles").select("usuario");

    expect(error).toBeNull();
    expect(data).toEqual([{ usuario: funcionarioOutroSetor.usuario }]);
  });

  it("somente o gestor cadastra e edita perfis", async () => {
    const { error: erroInsercaoLider } = await clienteLider.from("profiles").insert({
      id: "40000000-0000-4000-8000-000000000009",
      auth_user_id: gestor.authUserId,
      store_id: fixtures.loja.id,
      nome: "Perfil invadido",
      usuario: "perfil.invadido",
    });
    expect(erroInsercaoLider?.code).toBe(CODIGO_PERMISSAO_NEGADA);

    const { data: edicaoLider } = await clienteLider
      .from("profiles")
      .update({ nome: "Nome invadido" })
      .eq("id", funcionario.perfilId)
      .select("nome");
    expect(edicaoLider).toEqual([]);

    const { data: edicaoGestor, error: erroGestor } = await clienteGestor
      .from("profiles")
      .update({ nome: "Funcionario Renomeado" })
      .eq("id", funcionario.perfilId)
      .select("nome");
    expect(erroGestor).toBeNull();
    expect(edicaoGestor).toEqual([{ nome: "Funcionario Renomeado" }]);

    await admin.from("profiles").update({ nome: funcionario.nome }).eq("id", funcionario.perfilId);
  });
});

describe("matriz RLS de memberships", () => {
  it("o gestor le todos os vinculos da loja", async () => {
    const { data, error } = await clienteGestor.from("memberships").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(fixtures.identidades.length);
  });

  it("o lider le apenas os vinculos do proprio setor", async () => {
    const { data, error } = await clienteLider.from("memberships").select("profile_id");

    expect(error).toBeNull();
    expect(data?.map((vinculo) => vinculo.profile_id).sort()).toEqual(
      [lider.perfilId, funcionario.perfilId].sort(),
    );
  });

  it("o funcionario le apenas os vinculos do proprio setor", async () => {
    const { data, error } = await clienteFuncionarioOutroSetor
      .from("memberships")
      .select("profile_id");

    expect(error).toBeNull();
    expect(data).toEqual([{ profile_id: funcionarioOutroSetor.perfilId }]);
  });

  it("somente o gestor promove, transfere e remove vinculos", async () => {
    const { error: erroPromocaoLider } = await clienteLider.from("memberships").insert({
      profile_id: funcionario.perfilId,
      store_id: fixtures.loja.id,
      sector_id: acougue.id,
      papel: "lider",
    });
    expect(erroPromocaoLider?.code).toBe(CODIGO_PERMISSAO_NEGADA);

    const { data: transferenciaLider } = await clienteLider
      .from("memberships")
      .update({ sector_id: acougue.id })
      .eq("profile_id", funcionario.perfilId)
      .select("sector_id");
    expect(transferenciaLider).toEqual([]);

    const { data: transferenciaGestor, error: erroGestor } = await clienteGestor
      .from("memberships")
      .update({ sector_id: acougue.id })
      .eq("profile_id", funcionario.perfilId)
      .select("sector_id");
    expect(erroGestor).toBeNull();
    expect(transferenciaGestor).toEqual([{ sector_id: acougue.id }]);

    await admin
      .from("memberships")
      .update({ sector_id: mercearia.id })
      .eq("profile_id", funcionario.perfilId);
  });
});

describe("matriz RLS para cliente anonimo", () => {
  it("nao expoe nenhuma tabela organizacional", async () => {
    for (const tabela of ["stores", "sectors", "profiles", "memberships"]) {
      const { data, error } = await clienteAnonimo.from(tabela).select("id");

      expect(error, `tabela ${tabela}`).not.toBeNull();
      expect(data, `tabela ${tabela}`).toBeNull();
    }
  });
});
