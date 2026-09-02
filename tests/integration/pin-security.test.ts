import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { autenticar } from "../../src/features/identity/auth-service";
import {
  consultarEstadoPin,
  desbloquearPin,
  MAXIMO_TENTATIVAS,
  MINUTOS_DE_BLOQUEIO,
  registrarTentativaPin,
} from "../../src/features/identity/pin-service";
import { criarIdentidadesDeTeste, identidadePorUsuario } from "../fixtures/identities";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PIN_CORRETO = "246810";
const PIN_ERRADO = "999999";
const DESCONHECIDO = "ninguem.existe";

const fixtures = criarIdentidadesDeTeste();
const gestor = identidadePorUsuario("gestor.teste");
const funcionario = identidadePorUsuario("funcionario.teste");

let admin: SupabaseClient;

function clientePublico(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false } });
}

function segredoDe(usuario: string): string {
  return usuario === funcionario.usuario ? PIN_CORRETO : identidadePorUsuario(usuario).senha;
}

async function limparTentativas(): Promise<void> {
  await admin.from("pin_attempts").delete().not("identificador", "is", null);
  await admin.from("audit_events").delete().not("id", "is", null);
}

async function limpar(): Promise<void> {
  await limparTentativas();
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

async function errarAte(identificador: string, vezes: number, perfilId: string | null) {
  let estado = await consultarEstadoPin(admin, identificador);

  for (let tentativa = 0; tentativa < vezes; tentativa += 1) {
    estado = await registrarTentativaPin(admin, { identificador, perfilId, sucesso: false });
  }

  return estado;
}

beforeAll(async () => {
  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  admin = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });

  await limpar();
  await semear();
}, 60_000);

beforeEach(async () => {
  await limparTentativas();
}, 60_000);

afterAll(async () => {
  await limpar();
}, 60_000);

describe("contagem e bloqueio do PIN", () => {
  it("bloqueia depois de cinco tentativas invalidas consecutivas", async () => {
    const antes = await errarAte(funcionario.usuario, MAXIMO_TENTATIVAS - 1, funcionario.perfilId);
    expect(antes.bloqueado).toBe(false);
    expect(antes.tentativas).toBe(MAXIMO_TENTATIVAS - 1);

    const depois = await registrarTentativaPin(admin, {
      identificador: funcionario.usuario,
      perfilId: funcionario.perfilId,
      sucesso: false,
    });

    expect(depois.bloqueado).toBe(true);
    expect(depois.liberadoEm).not.toBeNull();

    // A janela e medida entre dois instantes do proprio banco. Comparar com o
    // relogio da maquina de teste introduziria o desvio entre os dois.
    const { data: linha } = await admin
      .from("pin_attempts")
      .select("atualizado_em, bloqueado_ate")
      .eq("identificador", funcionario.usuario)
      .single();

    const janela =
      (new Date(linha!.bloqueado_ate).getTime() - new Date(linha!.atualizado_em).getTime()) /
      60_000;
    expect(janela).toBeGreaterThanOrEqual(MINUTOS_DE_BLOQUEIO - 0.5);
    expect(janela).toBeLessThanOrEqual(MINUTOS_DE_BLOQUEIO + 0.5);
  });

  it("recusa a sexta tentativa durante o bloqueio, mesmo com o PIN correto", async () => {
    await errarAte(funcionario.usuario, MAXIMO_TENTATIVAS, funcionario.perfilId);

    const resultado = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: funcionario.usuario, segredo: PIN_CORRETO },
    );

    expect(resultado.situacao).toBe("bloqueado");
  });

  it("zera a contagem quando o acesso da certo antes do limite", async () => {
    await errarAte(funcionario.usuario, MAXIMO_TENTATIVAS - 1, funcionario.perfilId);

    const estado = await registrarTentativaPin(admin, {
      identificador: funcionario.usuario,
      perfilId: funcionario.perfilId,
      sucesso: true,
    });

    expect(estado).toEqual({ bloqueado: false, liberadoEm: null, tentativas: 0 });
  });

  it("trata identificador inexistente igual a um existente", async () => {
    const conhecido = await errarAte(funcionario.usuario, MAXIMO_TENTATIVAS, funcionario.perfilId);
    const desconhecido = await errarAte(DESCONHECIDO, MAXIMO_TENTATIVAS, null);

    expect(desconhecido.bloqueado).toBe(conhecido.bloqueado);
    expect(desconhecido.tentativas).toBe(conhecido.tentativas);

    const respostaConhecido = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: funcionario.usuario, segredo: PIN_ERRADO },
    );
    const respostaDesconhecido = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: DESCONHECIDO, segredo: PIN_ERRADO },
    );

    // O instante de liberacao muda com o horario de cada tentativa; o que nao
    // pode variar e a situacao e a frase devolvida.
    expect(respostaDesconhecido.situacao).toBe(respostaConhecido.situacao);
    expect(respostaDesconhecido).toHaveProperty("motivo");
    expect(respostaConhecido).toHaveProperty("motivo");
    expect((respostaDesconhecido as { motivo: string }).motivo).toBe(
      (respostaConhecido as { motivo: string }).motivo,
    );
  });

  it("libera o acesso quando o bloqueio expira", async () => {
    await errarAte(funcionario.usuario, MAXIMO_TENTATIVAS, funcionario.perfilId);

    await admin
      .from("pin_attempts")
      .update({ bloqueado_ate: new Date(Date.now() - 60_000).toISOString() })
      .eq("identificador", funcionario.usuario);

    const estado = await consultarEstadoPin(admin, funcionario.usuario);
    expect(estado.bloqueado).toBe(false);

    const resultado = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: funcionario.usuario, segredo: PIN_CORRETO },
    );

    expect(resultado.situacao).toBe("autenticado");
  });
});

describe("desbloqueio pelo gestor", () => {
  it("restaura o acesso antes do prazo", async () => {
    await errarAte(funcionario.usuario, MAXIMO_TENTATIVAS, funcionario.perfilId);
    expect((await consultarEstadoPin(admin, funcionario.usuario)).bloqueado).toBe(true);

    await desbloquearPin(admin, {
      perfilId: funcionario.perfilId,
      atorPerfilId: gestor.perfilId,
    });

    expect(await consultarEstadoPin(admin, funcionario.usuario)).toEqual({
      bloqueado: false,
      liberadoEm: null,
      tentativas: 0,
    });

    const resultado = await autenticar(
      { admin, publico: clientePublico() },
      { identificador: funcionario.usuario, segredo: PIN_CORRETO },
    );

    expect(resultado.situacao).toBe("autenticado");
  });
});

describe("auditoria do PIN", () => {
  it("registra o bloqueio e o desbloqueio com ator e entidade", async () => {
    await errarAte(funcionario.usuario, MAXIMO_TENTATIVAS, funcionario.perfilId);
    await desbloquearPin(admin, {
      perfilId: funcionario.perfilId,
      atorPerfilId: gestor.perfilId,
    });

    const { data } = await admin
      .from("audit_events")
      .select("acao, entidade, entidade_id, ator_perfil_id")
      .order("created_at");

    expect(data).toEqual([
      {
        acao: "pin_bloqueado",
        entidade: "profiles",
        entidade_id: funcionario.perfilId,
        ator_perfil_id: funcionario.perfilId,
      },
      {
        acao: "pin_desbloqueado",
        entidade: "profiles",
        entidade_id: funcionario.perfilId,
        ator_perfil_id: gestor.perfilId,
      },
    ]);
  });

  it("nao guarda o PIN tentado em lugar nenhum", async () => {
    await errarAte(funcionario.usuario, 2, funcionario.perfilId);

    const { data: tentativas } = await admin.from("pin_attempts").select("*");
    const { data: eventos } = await admin.from("audit_events").select("*");

    expect(JSON.stringify({ tentativas, eventos })).not.toContain(PIN_ERRADO);
    expect(JSON.stringify({ tentativas, eventos })).not.toContain(PIN_CORRETO);
  });
});
