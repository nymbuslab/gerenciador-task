import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Assistente de configuracao inicial (decisao D-28).
 *
 * Fica disponivel somente enquanto nao existir loja e gestor. A conclusao
 * acontece dentro de uma unica transacao no banco, que tambem grava a trava
 * permanente e o evento de auditoria. Duas solicitacoes concorrentes so podem
 * terminar de um jeito: uma cria a loja, a outra e recusada.
 */

const CODIGO_JA_CONCLUIDO = "P0001";

export const entradaBootstrapSchema = z.object({
  lojaNome: z.string().trim().min(2).max(120),
  gestorNome: z.string().trim().min(2).max(120),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "usuario aceita letras minusculas, numeros, ponto, hifen e sublinhado"),
  email: z.email().max(160),
  senha: z
    .string()
    .min(12, "a senha do gestor precisa de ao menos 12 caracteres")
    .max(72)
    .regex(/[A-Za-z]/, "a senha precisa de ao menos uma letra")
    .regex(/[0-9]/, "a senha precisa de ao menos um numero"),
});

export type EntradaBootstrap = z.infer<typeof entradaBootstrapSchema>;

export type ResultadoBootstrap =
  | { situacao: "concluido"; lojaId: string; perfilId: string }
  | { situacao: "indisponivel" }
  | { situacao: "invalido"; motivos: string[] }
  | { situacao: "falha"; motivo: string };

export async function bootstrapDisponivel(admin: SupabaseClient): Promise<boolean> {
  const { count, error } = await admin
    .from("bootstrap_state")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Nao foi possivel consultar a trava do assistente: ${error.message}`);
  }

  return (count ?? 0) === 0;
}

export async function executarBootstrap(
  admin: SupabaseClient,
  entrada: unknown,
): Promise<ResultadoBootstrap> {
  const validacao = entradaBootstrapSchema.safeParse(entrada);

  if (!validacao.success) {
    return {
      situacao: "invalido",
      motivos: validacao.error.issues.map((problema) => problema.message),
    };
  }

  const dados = validacao.data;

  if (!(await bootstrapDisponivel(admin))) {
    return { situacao: "indisponivel" };
  }

  const { data: usuarioCriado, error: erroUsuario } = await admin.auth.admin.createUser({
    email: dados.email,
    password: dados.senha,
    email_confirm: true,
  });

  if (erroUsuario || !usuarioCriado?.user) {
    return { situacao: "falha", motivo: "nao foi possivel criar a conta do gestor" };
  }

  const authUserId = usuarioCriado.user.id;

  const { data, error } = await admin.rpc("concluir_bootstrap", {
    p_auth_user_id: authUserId,
    p_loja_nome: dados.lojaNome,
    p_gestor_nome: dados.gestorNome,
    p_usuario: dados.usuario,
    p_email: dados.email,
  });

  if (error) {
    await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);

    if (error.code === CODIGO_JA_CONCLUIDO) {
      return { situacao: "indisponivel" };
    }

    return { situacao: "falha", motivo: "nao foi possivel concluir a configuracao inicial" };
  }

  const criado = Array.isArray(data) ? data[0] : data;

  if (!criado?.loja_id || !criado?.perfil_id) {
    await admin.auth.admin.deleteUser(authUserId).catch(() => undefined);
    return { situacao: "falha", motivo: "resposta inesperada do banco" };
  }

  return { situacao: "concluido", lojaId: criado.loja_id, perfilId: criado.perfil_id };
}
