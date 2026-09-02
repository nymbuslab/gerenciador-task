import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Conversa dentro da tarefa e caixa de entrada interna (decisoes D-14 e D-17).
 *
 * Comentar e mencionar passam pela funcao `comentar`, que grava o comentario,
 * as mencoes e os avisos na mesma transacao. Mencionar quem nao recebeu a
 * tarefa nao produz aviso: o filtro fica no banco, junto do dado.
 */

export type Comentario = {
  id: string;
  ocorrenciaId: string;
  execucaoId: string | null;
  autorPerfilId: string | null;
  autorNome: string | null;
  texto: string;
  criadoEm: string;
  mencionados: string[];
};

export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  entidade: string | null;
  entidadeId: string | null;
  lidaEm: string | null;
  criadaEm: string;
};

export type ResultadoComentario =
  | { situacao: "ok"; comentarioId: string; criadoEm: string }
  | { situacao: "recusado"; motivo: string };

export async function comentar(
  cliente: SupabaseClient,
  entrada: {
    ocorrenciaId: string;
    texto: string;
    execucaoId?: string | null;
    mencionados?: string[];
  },
): Promise<ResultadoComentario> {
  const texto = entrada.texto.trim();

  if (texto.length === 0) {
    return { situacao: "recusado", motivo: "o comentário está vazio" };
  }

  if (texto.length > 2000) {
    return { situacao: "recusado", motivo: "o comentário passa de 2000 caracteres" };
  }

  const { data, error } = await cliente.rpc("comentar", {
    p_ocorrencia: entrada.ocorrenciaId,
    p_texto: texto,
    p_execucao: entrada.execucaoId ?? null,
    p_mencionados: entrada.mencionados ?? [],
  });

  if (error) {
    return { situacao: "recusado", motivo: "não foi possível publicar o comentário" };
  }

  const criado = (Array.isArray(data) ? data[0] : data) as
    | { id: string; created_at: string }
    | undefined;

  if (!criado) {
    return { situacao: "recusado", motivo: "resposta inesperada do banco" };
  }

  return { situacao: "ok", comentarioId: criado.id, criadoEm: criado.created_at };
}

export async function listarComentarios(
  cliente: SupabaseClient,
  ocorrenciaId: string,
): Promise<Comentario[]> {
  const { data } = await cliente
    .from("comments")
    .select(
      "id, occurrence_id, execution_id, autor_perfil_id, texto, created_at," +
        " profiles(nome), mentions(profile_id)",
    )
    .eq("occurrence_id", ocorrenciaId)
    .order("created_at");

  type Linha = {
    id: string;
    occurrence_id: string;
    execution_id: string | null;
    autor_perfil_id: string | null;
    texto: string;
    created_at: string;
    profiles: { nome: string } | { nome: string }[] | null;
    mentions: { profile_id: string }[] | null;
  };

  return ((data ?? []) as unknown as Linha[]).map((linha) => {
    const autor = Array.isArray(linha.profiles) ? linha.profiles[0] : linha.profiles;

    return {
      id: linha.id,
      ocorrenciaId: linha.occurrence_id,
      execucaoId: linha.execution_id,
      autorPerfilId: linha.autor_perfil_id,
      autorNome: autor?.nome ?? null,
      texto: linha.texto,
      criadoEm: linha.created_at,
      mencionados: (linha.mentions ?? []).map((mencao) => mencao.profile_id),
    };
  });
}

export async function listarNotificacoes(
  cliente: SupabaseClient,
  opcoes: { apenasNaoLidas?: boolean } = {},
): Promise<Notificacao[]> {
  let consulta = cliente
    .from("notifications")
    .select("id, tipo, titulo, corpo, entidade, entidade_id, lida_em, created_at")
    .order("created_at", { ascending: false });

  if (opcoes.apenasNaoLidas) {
    consulta = consulta.is("lida_em", null);
  }

  const { data } = await consulta;

  return (data ?? []).map((linha) => ({
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    corpo: linha.corpo,
    entidade: linha.entidade,
    entidadeId: linha.entidade_id,
    lidaEm: linha.lida_em,
    criadaEm: linha.created_at,
  }));
}

export async function marcarNotificacaoLida(
  cliente: SupabaseClient,
  notificacaoId: string,
): Promise<boolean> {
  const { data } = await cliente
    .from("notifications")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", notificacaoId)
    .select("id");

  return (data ?? []).length > 0;
}
