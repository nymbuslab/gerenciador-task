import type { SupabaseClient } from "@supabase/supabase-js";

import type { Papel } from "../../components/navigation";
import {
  consultarEstadoPin,
  registrarTentativaPin,
  type EstadoPin,
} from "./pin-service";

/**
 * Sessao e login por papel (decisao D-11).
 *
 * Liderança entra por e-mail e senha forte. Funcionario entra por usuario e
 * PIN: o servidor resolve o usuario para a identidade interna do Supabase, que
 * nunca volta para a interface. Toda recusa devolve a mesma frase, para que a
 * tela nao sirva de sonda de quem existe na loja.
 */

const MOTIVO_NEUTRO = "Usuário ou senha incorretos.";
const MOTIVO_BLOQUEIO =
  "Acesso bloqueado por tentativas inválidas. Tente de novo mais tarde ou peça desbloqueio ao gestor.";

const ROTA_INICIAL: Record<Papel, string> = {
  funcionario: "/hoje",
  lider: "/setor",
  gestor: "/operacao",
};

export type Sessao = {
  perfilId: string;
  nome: string;
  papel: Papel;
  lojaId: string;
  setorId: string | null;
};

export type EntradaAutenticacao = {
  identificador: string;
  segredo: string;
};

export type Clientes = {
  /** Service Role. Vive somente no servidor e resolve a identidade interna. */
  admin: SupabaseClient;
  /** Chave anonima, sujeita a RLS. Abre a sessao de quem esta entrando. */
  publico: SupabaseClient;
};

export type ResultadoAutenticacao =
  | { situacao: "autenticado"; destino: string; sessao: Sessao }
  | { situacao: "bloqueado"; motivo: string; liberadoEm: string | null }
  | { situacao: "negado"; motivo: string };

export function rotaInicialDoPapel(papel: Papel): string {
  return ROTA_INICIAL[papel];
}

function negado(): ResultadoAutenticacao {
  return { situacao: "negado", motivo: MOTIVO_NEUTRO };
}

function bloqueado(estado: EstadoPin): ResultadoAutenticacao {
  return { situacao: "bloqueado", motivo: MOTIVO_BLOQUEIO, liberadoEm: estado.liberadoEm };
}

type Identidade = { perfilId: string | null; email: string | null };

/**
 * Acesso por PIN e o unico protegido pela contagem de tentativas. Liderança
 * entra por e-mail e fica de fora de proposito: um gestor trancado nao teria
 * quem o destrancasse.
 */
function ehAcessoPorPin(identificador: string): boolean {
  return !identificador.includes("@");
}

async function resolverIdentidade(
  admin: SupabaseClient,
  identificador: string,
): Promise<Identidade> {
  const coluna = ehAcessoPorPin(identificador) ? "usuario" : "email";

  const { data, error } = await admin
    .from("profiles")
    .select("id, email")
    .eq(coluna, identificador.toLowerCase())
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data?.email) {
    return { perfilId: null, email: null };
  }

  return { perfilId: data.id, email: data.email };
}

export async function carregarSessao(cliente: SupabaseClient): Promise<Sessao | null> {
  const { data: autenticado } = await cliente.auth.getUser();

  if (!autenticado?.user) {
    return null;
  }

  const { data, error } = await cliente
    .from("memberships")
    .select("papel, store_id, sector_id, profiles!inner(id, nome, auth_user_id)")
    .eq("ativo", true)
    .eq("profiles.auth_user_id", autenticado.user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const perfil = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  if (!perfil) {
    return null;
  }

  return {
    perfilId: perfil.id,
    nome: perfil.nome,
    papel: data.papel as Papel,
    lojaId: data.store_id,
    setorId: data.sector_id,
  };
}

export async function autenticar(
  clientes: Clientes,
  entrada: EntradaAutenticacao,
): Promise<ResultadoAutenticacao> {
  const identificador = entrada.identificador.trim();

  if (identificador.length === 0 || entrada.segredo.length === 0) {
    return negado();
  }

  const porPin = ehAcessoPorPin(identificador);

  if (porPin) {
    const estado = await consultarEstadoPin(clientes.admin, identificador);

    if (estado.bloqueado) {
      return bloqueado(estado);
    }
  }

  const identidade = await resolverIdentidade(clientes.admin, identificador);

  async function contabilizar(sucesso: boolean): Promise<EstadoPin | null> {
    if (!porPin) {
      return null;
    }

    return registrarTentativaPin(clientes.admin, {
      identificador,
      perfilId: identidade.perfilId,
      sucesso,
    });
  }

  if (!identidade.email) {
    const estado = await contabilizar(false);
    return estado?.bloqueado ? bloqueado(estado) : negado();
  }

  const { error } = await clientes.publico.auth.signInWithPassword({
    email: identidade.email,
    password: entrada.segredo,
  });

  if (error) {
    const estado = await contabilizar(false);
    return estado?.bloqueado ? bloqueado(estado) : negado();
  }

  const sessao = await carregarSessao(clientes.publico);

  if (!sessao) {
    await clientes.publico.auth.signOut();
    await contabilizar(false);
    return negado();
  }

  await contabilizar(true);

  return { situacao: "autenticado", destino: rotaInicialDoPapel(sessao.papel), sessao };
}
