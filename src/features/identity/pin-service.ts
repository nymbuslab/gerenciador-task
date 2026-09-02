import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Protecao do acesso por PIN (decisao D-25).
 *
 * Cinco tentativas invalidas consecutivas bloqueiam o acesso por 15 minutos.
 * A contagem e por identificador digitado, e nao por perfil: quem tenta um
 * usuario que nao existe recebe exatamente a mesma resposta de quem tenta um
 * usuario real, entao a tela de entrada nao revela a equipe da loja.
 */

export const MAXIMO_TENTATIVAS = 5;
export const MINUTOS_DE_BLOQUEIO = 15;

export type EstadoPin = {
  bloqueado: boolean;
  liberadoEm: string | null;
  tentativas: number;
};

type LinhaEstado = {
  bloqueado: boolean;
  liberado_em: string | null;
  tentativas: number;
};

function normalizar(linha: LinhaEstado | undefined): EstadoPin {
  return {
    bloqueado: linha?.bloqueado ?? false,
    liberadoEm: linha?.liberado_em ?? null,
    tentativas: linha?.tentativas ?? 0,
  };
}

function primeira(dados: unknown): LinhaEstado | undefined {
  return (Array.isArray(dados) ? dados[0] : dados) as LinhaEstado | undefined;
}

export async function consultarEstadoPin(
  admin: SupabaseClient,
  identificador: string,
): Promise<EstadoPin> {
  const { data, error } = await admin.rpc("estado_pin", { p_identificador: identificador });

  if (error) {
    throw new Error(`Nao foi possivel consultar o estado do PIN: ${error.message}`);
  }

  return normalizar(primeira(data));
}

export async function registrarTentativaPin(
  admin: SupabaseClient,
  entrada: { identificador: string; perfilId: string | null; sucesso: boolean },
): Promise<EstadoPin> {
  const { data, error } = await admin.rpc("registrar_tentativa_pin", {
    p_identificador: entrada.identificador,
    p_profile_id: entrada.perfilId,
    p_sucesso: entrada.sucesso,
  });

  if (error) {
    throw new Error(`Nao foi possivel registrar a tentativa de PIN: ${error.message}`);
  }

  return normalizar(primeira(data));
}

/**
 * Redefinicao de acesso pelo gestor. Zera a contagem de tentativas e deixa a
 * marca na auditoria com acao propria, para nao confundir com um desbloqueio
 * que manteve o mesmo PIN.
 */
export async function registrarRedefinicaoPin(
  admin: SupabaseClient,
  entrada: { perfilId: string; atorPerfilId: string },
): Promise<void> {
  const { error } = await admin.rpc("redefinir_pin", {
    p_profile_id: entrada.perfilId,
    p_ator_perfil_id: entrada.atorPerfilId,
  });

  if (error) {
    throw new Error(`Nao foi possivel registrar a redefinicao do PIN: ${error.message}`);
  }
}

export async function desbloquearPin(
  admin: SupabaseClient,
  entrada: { perfilId: string; atorPerfilId: string },
): Promise<void> {
  const { error } = await admin.rpc("desbloquear_pin", {
    p_profile_id: entrada.perfilId,
    p_ator_perfil_id: entrada.atorPerfilId,
  });

  if (error) {
    throw new Error(`Nao foi possivel desbloquear o PIN: ${error.message}`);
  }
}
