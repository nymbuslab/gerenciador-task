import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { autenticar } from "../../src/features/identity/auth-service";
import { consultarEstadoPin, registrarTentativaPin } from "../../src/features/identity/pin-service";
import {
  arquivarPessoa,
  cadastrarFuncionario,
  criarSetor,
  emailInterno,
  promoverALider,
  redefinirPin,
  transferirDeSetor,
  type ClientesAdministrativos,
} from "../../src/features/administration/team-service";
import { criarIdentidadesDeTeste, identidadePorUsuario } from "../fixtures/identities";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PIN_INICIAL = "135791";
const PIN_NOVO = "864202";
const NOVO_USUARIO = "joana.reposicao";

const fixtures = criarIdentidadesDeTeste();
const [mercearia, acougue] = fixtures.setores;
const gestor = identidadePorUsuario("gestor.teste");
const lider = identidadePorUsuario("lider.teste");

let admin: SupabaseClient;
let comoGestor: SupabaseClient;
let comoLider: SupabaseClient;
let clientesDoGestor: ClientesAdministrativos;
let clientesDoLider: ClientesAdministrativos;

function clientePublico(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false } });
}

async function autenticado(email: string, senha: string): Promise<SupabaseClient> {
  const cliente = clientePublico();
  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });

  if (error) {
    throw new Error(`Falha ao autenticar ${email}: ${error.message}`);
  }

  return cliente;
}

async function removerContaInterna(usuario: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const alvo = data?.users.find((conta) => conta.email === emailInterno(usuario));

  if (alvo) {
    await admin.auth.admin.deleteUser(alvo.id);
  }
}

async function limpar(): Promise<void> {
  await admin.from("pin_attempts").delete().not("identificador", "is", null);
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin.from("memberships").delete().eq("store_id", fixtures.loja.id);
  await admin.from("profiles").delete().eq("store_id", fixtures.loja.id);
  await admin.from("sectors").delete().eq("store_id", fixtures.loja.id);
  await admin.from("stores").delete().eq("id", fixtures.loja.id);

  for (const identidade of fixtures.identidades) {
    await admin.auth.admin.deleteUser(identidade.authUserId).catch(() => undefined);
  }

  await removerContaInterna(NOVO_USUARIO);
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
      password: identidade.senha,
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
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });

  await limpar();
  await semear();

  comoGestor = await autenticado(gestor.email, gestor.senha);
  comoLider = await autenticado(lider.email, lider.senha);
  clientesDoGestor = { admin, comoAtor: comoGestor };
  clientesDoLider = { admin, comoAtor: comoLider };
}, 90_000);

afterAll(async () => {
  await limpar();
}, 60_000);

describe("administracao de setores", () => {
  it("o gestor cria setor e o lider nao", async () => {
    const recusa = await criarSetor(clientesDoLider, { nome: "Padaria do lider" });
    expect(recusa.situacao).toBe("negado");

    const criacao = await criarSetor(clientesDoGestor, { nome: "Padaria" });
    expect(criacao.situacao).toBe("ok");

    if (criacao.situacao !== "ok") {
      throw new Error("Esperava setor criado");
    }

    const { data } = await admin.from("sectors").select("nome").eq("id", criacao.dados.setorId);
    expect(data).toEqual([{ nome: "Padaria" }]);

    await admin.from("sectors").delete().eq("id", criacao.dados.setorId);
  });

  it("recusa nome de setor invalido antes de tocar no banco", async () => {
    const resultado = await criarSetor(clientesDoGestor, { nome: "x" });

    expect(resultado.situacao).toBe("invalido");
  });
});

describe("ciclo de vida de uma pessoa da equipe", () => {
  it("cadastra, promove, transfere, redefine o PIN e arquiva", async () => {
    const recusaDoLider = await cadastrarFuncionario(clientesDoLider, {
      nome: "Joana Reposicao",
      usuario: NOVO_USUARIO,
      setorId: mercearia.id,
      pin: PIN_INICIAL,
    });
    expect(recusaDoLider.situacao).toBe("negado");

    const cadastro = await cadastrarFuncionario(clientesDoGestor, {
      nome: "Joana Reposicao",
      usuario: NOVO_USUARIO,
      setorId: mercearia.id,
      pin: PIN_INICIAL,
    });

    if (cadastro.situacao !== "ok") {
      throw new Error(`Esperava cadastro, recebeu ${cadastro.situacao}`);
    }

    const perfilId = cadastro.dados.perfilId;

    const entradaInicial = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: NOVO_USUARIO, segredo: PIN_INICIAL },
    );
    expect(entradaInicial.situacao).toBe("autenticado");
    if (entradaInicial.situacao === "autenticado") {
      expect(entradaInicial.sessao.papel).toBe("funcionario");
      expect(entradaInicial.sessao.setorId).toBe(mercearia.id);
    }

    expect((await promoverALider(clientesDoLider, perfilId)).situacao).toBe("negado");
    expect((await promoverALider(clientesDoGestor, perfilId)).situacao).toBe("ok");

    expect((await transferirDeSetor(clientesDoGestor, perfilId, acougue.id)).situacao).toBe("ok");

    const comoNovoLider = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: NOVO_USUARIO, segredo: PIN_INICIAL },
    );
    if (comoNovoLider.situacao !== "autenticado") {
      throw new Error("Esperava o novo lider autenticado");
    }
    expect(comoNovoLider.sessao.papel).toBe("lider");
    expect(comoNovoLider.sessao.setorId).toBe(acougue.id);
    expect(comoNovoLider.destino).toBe("/setor");

    await registrarTentativaPin(admin, {
      identificador: NOVO_USUARIO,
      perfilId,
      sucesso: false,
    });

    expect((await redefinirPin(clientesDoLider, perfilId, PIN_NOVO)).situacao).toBe("negado");
    expect((await redefinirPin(clientesDoGestor, perfilId, PIN_NOVO)).situacao).toBe("ok");

    expect(await consultarEstadoPin(admin, NOVO_USUARIO)).toEqual({
      bloqueado: false,
      liberadoEm: null,
      tentativas: 0,
    });

    const comPinAntigo = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: NOVO_USUARIO, segredo: PIN_INICIAL },
    );
    expect(comPinAntigo.situacao).toBe("negado");

    const comPinNovo = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: NOVO_USUARIO, segredo: PIN_NOVO },
    );
    expect(comPinNovo.situacao).toBe("autenticado");

    expect((await arquivarPessoa(clientesDoLider, perfilId)).situacao).toBe("negado");
    expect((await arquivarPessoa(clientesDoGestor, perfilId)).situacao).toBe("ok");

    const depoisDeArquivar = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: NOVO_USUARIO, segredo: PIN_NOVO },
    );
    expect(depoisDeArquivar.situacao).toBe("negado");

    const { data: vinculo } = await admin
      .from("memberships")
      .select("ativo")
      .eq("profile_id", perfilId);
    expect(vinculo).toEqual([{ ativo: false }]);
  }, 90_000);

  it("recusa PIN fora do formato de seis digitos", async () => {
    const resultado = await redefinirPin(clientesDoGestor, gestor.perfilId, "12ab");

    expect(resultado.situacao).toBe("invalido");
  });
});

describe("auditoria da administracao", () => {
  it("registra as acoes do gestor com ator e entidade", async () => {
    // O teste anterior arquiva a pessoa, e o perfil arquivado mantem o usuario
    // reservado pela unicidade por loja. Aqui o registro sai de vez, para que o
    // mesmo usuario possa ser cadastrado de novo.
    await admin.from("audit_events").delete().not("id", "is", null);
    await admin.from("memberships").delete().eq("store_id", fixtures.loja.id).eq("papel", "lider");
    await admin.from("profiles").delete().eq("usuario", NOVO_USUARIO);
    await removerContaInterna(NOVO_USUARIO);

    const cadastro = await cadastrarFuncionario(clientesDoGestor, {
      nome: "Joana Reposicao",
      usuario: NOVO_USUARIO,
      setorId: mercearia.id,
      pin: PIN_INICIAL,
    });

    if (cadastro.situacao !== "ok") {
      throw new Error("Esperava cadastro para auditar");
    }

    await promoverALider(clientesDoGestor, cadastro.dados.perfilId);

    const { data } = await admin
      .from("audit_events")
      .select("acao, ator_perfil_id, entidade_id")
      .order("created_at");

    expect(data).toEqual([
      {
        acao: "funcionario_cadastrado",
        ator_perfil_id: gestor.perfilId,
        entidade_id: cadastro.dados.perfilId,
      },
      {
        acao: "lider_promovido",
        ator_perfil_id: gestor.perfilId,
        entidade_id: cadastro.dados.perfilId,
      },
    ]);

    await admin.from("memberships").delete().eq("profile_id", cadastro.dados.perfilId);
    await admin.from("profiles").delete().eq("id", cadastro.dados.perfilId);
    await removerContaInterna(NOVO_USUARIO);
  }, 90_000);
});
