import type { SupabaseClient } from "@supabase/supabase-js";

import { validarSaida } from "./image-compression";

/**
 * Evidencias de execucao.
 *
 * O binario vai para um bucket privado, num caminho que comeca pelo id da
 * execucao e termina num nome aleatorio. Ninguem le a foto por URL publica: o
 * acesso sai por link assinado de curta duracao, renovado a cada consulta.
 */

export const BUCKET_EVIDENCIAS = "evidencias";
export const SEGUNDOS_DA_URL_ASSINADA = 60;

export type ConteudoEvidencia = {
  execucaoId: string;
  lojaId: string;
  conteudo: Blob | ArrayBuffer | Uint8Array;
  bytes: number;
  tipo: string;
  largura?: number;
  altura?: number;
};

export type Evidencia = {
  id: string;
  execucaoId: string;
  caminho: string;
  bytes: number;
  largura: number | null;
  altura: number | null;
  criadaEm: string;
};

export type ResultadoEvidencia =
  | { situacao: "ok"; evidencia: Evidencia }
  | { situacao: "recusado"; motivo: string };

function nomeAleatorio(): string {
  return `${crypto.randomUUID()}.webp`;
}

export async function registrarEvidencia(
  cliente: SupabaseClient,
  entrada: ConteudoEvidencia,
): Promise<ResultadoEvidencia> {
  const limite = validarSaida({ tipo: entrada.tipo, bytes: entrada.bytes });

  if (limite.situacao === "recusado") {
    return limite;
  }

  const caminho = `${entrada.execucaoId}/${nomeAleatorio()}`;

  const { error: erroUpload } = await cliente.storage
    .from(BUCKET_EVIDENCIAS)
    .upload(caminho, entrada.conteudo, { contentType: entrada.tipo, upsert: false });

  if (erroUpload) {
    return { situacao: "recusado", motivo: "não foi possível enviar a foto" };
  }

  const { data, error } = await cliente
    .from("evidence")
    .insert({
      execution_id: entrada.execucaoId,
      store_id: entrada.lojaId,
      caminho,
      tipo: entrada.tipo,
      bytes: entrada.bytes,
      largura: entrada.largura ?? null,
      altura: entrada.altura ?? null,
    })
    .select("id, execution_id, caminho, bytes, largura, altura, created_at")
    .maybeSingle();

  if (error || !data) {
    // Sem o registro, o arquivo viraria lixo invisivel no bucket.
    await cliente.storage.from(BUCKET_EVIDENCIAS).remove([caminho]);

    return { situacao: "recusado", motivo: "não foi possível registrar a evidência" };
  }

  return {
    situacao: "ok",
    evidencia: {
      id: data.id,
      execucaoId: data.execution_id,
      caminho: data.caminho,
      bytes: data.bytes,
      largura: data.largura,
      altura: data.altura,
      criadaEm: data.created_at,
    },
  };
}

export async function listarEvidencias(
  cliente: SupabaseClient,
  execucaoId: string,
): Promise<Evidencia[]> {
  const { data } = await cliente
    .from("evidence")
    .select("id, execution_id, caminho, bytes, largura, altura, created_at")
    .eq("execution_id", execucaoId)
    .order("created_at");

  return (data ?? []).map((linha) => ({
    id: linha.id,
    execucaoId: linha.execution_id,
    caminho: linha.caminho,
    bytes: linha.bytes,
    largura: linha.largura,
    altura: linha.altura,
    criadaEm: linha.created_at,
  }));
}

export async function urlAssinada(
  cliente: SupabaseClient,
  caminho: string,
  segundos = SEGUNDOS_DA_URL_ASSINADA,
): Promise<string | null> {
  const { data, error } = await cliente.storage
    .from(BUCKET_EVIDENCIAS)
    .createSignedUrl(caminho, segundos);

  return error ? null : (data?.signedUrl ?? null);
}

export async function pendenciasDeConclusao(
  cliente: SupabaseClient,
  execucaoId: string,
): Promise<string[]> {
  const { data, error } = await cliente.rpc("pendencias_de_conclusao", {
    p_execucao: execucaoId,
  });

  if (error) {
    throw new Error(`Não foi possível conferir os requisitos: ${error.message}`);
  }

  return ((data ?? []) as { pendencia: string }[]).map((linha) => linha.pendencia);
}
