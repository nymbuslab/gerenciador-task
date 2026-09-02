import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  autenticar,
  carregarSessao,
  rotaInicialDoPapel,
} from "../../src/features/identity/auth-service";
import { criarIdentidadesDeTeste, identidadePorUsuario } from "../fixtures/identities";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PIN_DO_FUNCIONARIO = "246810";

const fixtures = criarIdentidadesDeTeste();
const gestor = identidadePorUsuario("gestor.teste");
const lider = identidadePorUsuario("lider.teste");
const funcionario = identidadePorUsuario("funcionario.teste");

let admin: SupabaseClient;

function clientePublico(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false } });
}

function segredoDe(usuario: string): string {
  return usuario === funcionario.usuario ? PIN_DO_FUNCIONARIO : identidadePorUsuario(usuario).senha;
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
  await admin.from("stores").insert({ id: fixtures.loja.id, nome: fixtures.loja.nome });
  await admin.from("sectors").insert(
    fixtures.setores.map((setor) => ({ id: setor.id, store_id: setor.lojaId, nome: setor.nome })),
  );

  for (const identidade of fixtures.identidades) {
    await admin.auth.admin.createUser({
      id: identidade.authUserId,
      email: identidade.email,
      password: segredoDe(identidade.usuario),
      email_confirm: true,
    });
  }

  await admin.from("profiles").insert(
    fixtures.identidades.map((identidade) => ({
      id: identidade.perfilId,
      auth_user_id: identidade.authUserId,
      store_id: identidade.lojaId,
      nome: identidade.nome,
      usuario: identidade.usuario,
      email: identidade.email,
    })),
  );

  await admin.from("memberships").insert(
    fixtures.identidades.map((identidade) => ({
      profile_id: identidade.perfilId,
      store_id: identidade.lojaId,
      sector_id: identidade.setorId,
      papel: identidade.papel,
    })),
  );
}

beforeAll(async () => {
  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });

  await limpar();
  await semear();
}, 60_000);

afterAll(async () => {
  await limpar();
}, 60_000);

describe("rota inicial por papel", () => {
  it("leva cada papel para a propria visao", () => {
    expect(rotaInicialDoPapel("funcionario")).toBe("/hoje");
    expect(rotaInicialDoPapel("lider")).toBe("/setor");
    expect(rotaInicialDoPapel("gestor")).toBe("/operacao");
  });
});

describe("sessao por papel", () => {
  it("autentica o gestor por e-mail e senha e carrega o vinculo da loja", async () => {
    const publico = clientePublico();
    const resultado = await autenticar(
      { admin, publico },
      { identificador: gestor.email, segredo: gestor.senha },
    );

    expect(resultado).toEqual({
      situacao: "autenticado",
      destino: "/operacao",
      sessao: {
        perfilId: gestor.perfilId,
        nome: gestor.nome,
        papel: "gestor",
        lojaId: fixtures.loja.id,
        setorId: null,
      },
    });
  });

  it("autentica o lider e carrega o proprio setor", async () => {
    const publico = clientePublico();
    const resultado = await autenticar(
      { admin, publico },
      { identificador: lider.email, segredo: lider.senha },
    );

    if (resultado.situacao !== "autenticado") {
      throw new Error("Esperava lider autenticado");
    }

    expect(resultado.destino).toBe("/setor");
    expect(resultado.sessao.papel).toBe("lider");
    expect(resultado.sessao.setorId).toBe(fixtures.setores[0].id);
  });

  it("autentica o funcionario por usuario e PIN sem expor a identidade interna", async () => {
    const publico = clientePublico();
    const resultado = await autenticar(
      { admin, publico },
      { identificador: funcionario.usuario, segredo: PIN_DO_FUNCIONARIO },
    );

    if (resultado.situacao !== "autenticado") {
      throw new Error("Esperava funcionario autenticado");
    }

    expect(resultado.destino).toBe("/hoje");
    expect(resultado.sessao.papel).toBe("funcionario");
    expect(resultado.sessao.setorId).toBe(fixtures.setores[0].id);
    expect(JSON.stringify(resultado)).not.toContain(funcionario.email);
  });

  it("carrega o vinculo a partir de uma sessao ja aberta", async () => {
    const publico = clientePublico();
    await publico.auth.signInWithPassword({ email: lider.email, password: lider.senha });

    const sessao = await carregarSessao(publico);

    expect(sessao).toEqual({
      perfilId: lider.perfilId,
      nome: lider.nome,
      papel: "lider",
      lojaId: fixtures.loja.id,
      setorId: fixtures.setores[0].id,
    });

    await publico.auth.signOut();
  });

  it("devolve nulo quando nao ha sessao aberta", async () => {
    expect(await carregarSessao(clientePublico())).toBeNull();
  });
});

describe("credenciais invalidas", () => {
  it("recusa segredo errado com mensagem neutra", async () => {
    const resultado = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: gestor.email, segredo: "SenhaErrada#2026" },
    );

    expect(resultado).toEqual({
      situacao: "negado",
      motivo: "Usuário ou senha incorretos.",
    });
  });

  it("nao revela se o usuario existe", async () => {
    const inexistente = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: "ninguem.aqui", segredo: "000000" },
    );
    const existente = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: funcionario.usuario, segredo: "999999" },
    );

    expect(inexistente).toEqual(existente);
  });

  it("recusa entrada vazia sem consultar o banco", async () => {
    const resultado = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: "", segredo: "" },
    );

    expect(resultado.situacao).toBe("negado");
  });
});
