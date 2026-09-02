import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { carregarSessao, type Sessao } from "../identity/auth-service";
import { registrarRedefinicaoPin } from "../identity/pin-service";

/**
 * Administração de equipe e setores pelo gestor (decisão D-27).
 *
 * As operações sobre loja, setores, perfis e vínculos usam o cliente do próprio
 * gestor, então quem decide o que pode acontecer é a RLS, e não uma checagem de
 * papel na aplicação. A Service Role entra apenas onde o Postgres não alcança:
 * criar a identidade do funcionário e trocar o segredo dela.
 */

export const DOMINIO_INTERNO_PADRAO = "identidades.interno";

export type ClientesAdministrativos = {
  /** Sessão de quem está administrando. Sujeita à RLS. */
  comoAtor: SupabaseClient;
  /** Service Role. Somente no servidor. */
  admin: SupabaseClient;
};

export type Resultado<T> =
  | { situacao: "ok"; dados: T }
  | { situacao: "negado"; motivo: string }
  | { situacao: "invalido"; motivos: string[] };

const MOTIVO_SEM_PERMISSAO = "Somente o gestor administra equipe e setores.";

const usuarioSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, "usuario aceita letras minusculas, numeros, ponto, hifen e sublinhado");

const pinSchema = z.string().regex(/^[0-9]{6}$/, "o PIN tem seis digitos");

export const novoFuncionarioSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  usuario: usuarioSchema,
  setorId: z.uuid(),
  pin: pinSchema,
});

export const novoSetorSchema = z.object({
  nome: z.string().trim().min(2).max(120),
});

export type NovoFuncionario = z.infer<typeof novoFuncionarioSchema>;

function negado<T>(): Resultado<T> {
  return { situacao: "negado", motivo: MOTIVO_SEM_PERMISSAO };
}

function invalido<T>(erro: z.ZodError): Resultado<T> {
  return { situacao: "invalido", motivos: erro.issues.map((problema) => problema.message) };
}

async function exigirGestor(comoAtor: SupabaseClient): Promise<Sessao | null> {
  const sessao = await carregarSessao(comoAtor);

  return sessao?.papel === "gestor" ? sessao : null;
}

export function emailInterno(usuario: string, dominio = DOMINIO_INTERNO_PADRAO): string {
  return `${usuario.toLowerCase()}@${dominio}`;
}

// Setores --------------------------------------------------------------------

export async function criarSetor(
  clientes: ClientesAdministrativos,
  entrada: unknown,
): Promise<Resultado<{ setorId: string }>> {
  const validacao = novoSetorSchema.safeParse(entrada);

  if (!validacao.success) {
    return invalido(validacao.error);
  }

  const sessao = await carregarSessao(clientes.comoAtor);

  if (!sessao) {
    return negado();
  }

  const { data, error } = await clientes.comoAtor
    .from("sectors")
    .insert({ store_id: sessao.lojaId, nome: validacao.data.nome })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return negado();
  }

  return { situacao: "ok", dados: { setorId: data.id } };
}

export async function arquivarSetor(
  clientes: ClientesAdministrativos,
  setorId: string,
): Promise<Resultado<{ setorId: string }>> {
  const { data, error } = await clientes.comoAtor
    .from("sectors")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", setorId)
    .select("id");

  if (error || !data || data.length === 0) {
    return negado();
  }

  return { situacao: "ok", dados: { setorId } };
}

// Pessoas --------------------------------------------------------------------

export async function cadastrarFuncionario(
  clientes: ClientesAdministrativos,
  entrada: unknown,
  dominioInterno = DOMINIO_INTERNO_PADRAO,
): Promise<Resultado<{ perfilId: string }>> {
  const validacao = novoFuncionarioSchema.safeParse(entrada);

  if (!validacao.success) {
    return invalido(validacao.error);
  }

  const sessao = await exigirGestor(clientes.comoAtor);

  if (!sessao) {
    return negado();
  }

  const dados = validacao.data;
  const email = emailInterno(dados.usuario, dominioInterno);

  const { data: criado, error: erroConta } = await clientes.admin.auth.admin.createUser({
    email,
    password: dados.pin,
    email_confirm: true,
  });

  if (erroConta || !criado?.user) {
    return { situacao: "invalido", motivos: ["nao foi possivel criar o acesso do funcionario"] };
  }

  const { data: perfil, error: erroPerfil } = await clientes.comoAtor
    .from("profiles")
    .insert({
      auth_user_id: criado.user.id,
      store_id: sessao.lojaId,
      nome: dados.nome,
      usuario: dados.usuario,
      email,
    })
    .select("id")
    .maybeSingle();

  if (erroPerfil || !perfil) {
    await clientes.admin.auth.admin.deleteUser(criado.user.id).catch(() => undefined);
    return negado();
  }

  const { error: erroVinculo } = await clientes.comoAtor.from("memberships").insert({
    profile_id: perfil.id,
    store_id: sessao.lojaId,
    sector_id: dados.setorId,
    papel: "funcionario",
  });

  if (erroVinculo) {
    await clientes.comoAtor.from("profiles").delete().eq("id", perfil.id);
    await clientes.admin.auth.admin.deleteUser(criado.user.id).catch(() => undefined);
    return negado();
  }

  await registrarEvento(clientes, sessao, "funcionario_cadastrado", perfil.id);

  return { situacao: "ok", dados: { perfilId: perfil.id } };
}

export async function promoverALider(
  clientes: ClientesAdministrativos,
  perfilId: string,
): Promise<Resultado<{ perfilId: string }>> {
  return trocarVinculo(clientes, perfilId, { papel: "lider" }, "lider_promovido");
}

export async function transferirDeSetor(
  clientes: ClientesAdministrativos,
  perfilId: string,
  setorId: string,
): Promise<Resultado<{ perfilId: string }>> {
  return trocarVinculo(clientes, perfilId, { sector_id: setorId }, "vinculo_transferido");
}

async function trocarVinculo(
  clientes: ClientesAdministrativos,
  perfilId: string,
  campos: Record<string, unknown>,
  acao: string,
): Promise<Resultado<{ perfilId: string }>> {
  const { data, error } = await clientes.comoAtor
    .from("memberships")
    .update(campos)
    .eq("profile_id", perfilId)
    .eq("ativo", true)
    .select("id");

  if (error || !data || data.length === 0) {
    return negado();
  }

  const sessao = await carregarSessao(clientes.comoAtor);

  if (sessao) {
    await registrarEvento(clientes, sessao, acao, perfilId);
  }

  return { situacao: "ok", dados: { perfilId } };
}

export async function arquivarPessoa(
  clientes: ClientesAdministrativos,
  perfilId: string,
): Promise<Resultado<{ perfilId: string }>> {
  const agora = new Date().toISOString();

  const { data, error } = await clientes.comoAtor
    .from("profiles")
    .update({ archived_at: agora })
    .eq("id", perfilId)
    .select("id");

  if (error || !data || data.length === 0) {
    return negado();
  }

  await clientes.comoAtor.from("memberships").update({ ativo: false }).eq("profile_id", perfilId);

  const sessao = await carregarSessao(clientes.comoAtor);

  if (sessao) {
    await registrarEvento(clientes, sessao, "pessoa_arquivada", perfilId);
  }

  return { situacao: "ok", dados: { perfilId } };
}

export async function redefinirPin(
  clientes: ClientesAdministrativos,
  perfilId: string,
  novoPin: string,
): Promise<Resultado<{ perfilId: string }>> {
  const validacao = pinSchema.safeParse(novoPin);

  if (!validacao.success) {
    return invalido(validacao.error);
  }

  const sessao = await exigirGestor(clientes.comoAtor);

  if (!sessao) {
    return negado();
  }

  const { data: perfil } = await clientes.comoAtor
    .from("profiles")
    .select("auth_user_id")
    .eq("id", perfilId)
    .maybeSingle();

  if (!perfil?.auth_user_id) {
    return negado();
  }

  const { error } = await clientes.admin.auth.admin.updateUserById(perfil.auth_user_id, {
    password: validacao.data,
  });

  if (error) {
    return negado();
  }

  await registrarRedefinicaoPin(clientes.admin, {
    perfilId,
    atorPerfilId: sessao.perfilId,
  });

  return { situacao: "ok", dados: { perfilId } };
}

async function registrarEvento(
  clientes: ClientesAdministrativos,
  sessao: Sessao,
  acao: string,
  perfilId: string,
): Promise<void> {
  await clientes.admin.from("audit_events").insert({
    store_id: sessao.lojaId,
    ator_perfil_id: sessao.perfilId,
    acao,
    entidade: "profiles",
    entidade_id: perfilId,
  });
}
