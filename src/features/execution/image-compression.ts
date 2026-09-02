/**
 * Regras de arquivo de evidencia (decisao D-24).
 *
 * A conversao acontece no aparelho de quem tira a foto: sobe menos byte pela
 * rede da loja e o servidor nunca recebe o original de 10 MB. As regras de
 * tipo, tamanho e quantidade ficam aqui, longe do canvas, para poderem ser
 * verificadas sem navegador.
 */

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const TIPO_DE_SAIDA = "image/webp";
export const BYTES_MAXIMOS_ENTRADA = 10 * 1024 * 1024;
export const BYTES_MAXIMOS_SAIDA = 2 * 1024 * 1024;
export const LADO_MAXIMO = 1920;
export const FOTOS_MINIMAS = 1;
export const FOTOS_MAXIMAS = 5;

export type ArquivoDeEntrada = { tipo: string; bytes: number };

export type Avaliacao = { situacao: "ok" } | { situacao: "recusado"; motivo: string };

const OK: Avaliacao = { situacao: "ok" };

function recusado(motivo: string): Avaliacao {
  return { situacao: "recusado", motivo };
}

export function validarEntrada(arquivo: ArquivoDeEntrada): Avaliacao {
  if (!TIPOS_ACEITOS.includes(arquivo.tipo as (typeof TIPOS_ACEITOS)[number])) {
    return recusado("a foto precisa ser JPEG, PNG ou WebP");
  }

  if (arquivo.bytes <= 0) {
    return recusado("o arquivo está vazio");
  }

  if (arquivo.bytes > BYTES_MAXIMOS_ENTRADA) {
    return recusado("a foto passa de 10 MB");
  }

  return OK;
}

export function validarSaida(arquivo: ArquivoDeEntrada): Avaliacao {
  if (arquivo.tipo !== TIPO_DE_SAIDA) {
    return recusado("a evidência precisa ser gravada em WebP");
  }

  if (arquivo.bytes <= 0) {
    return recusado("a compressão devolveu um arquivo vazio");
  }

  if (arquivo.bytes > BYTES_MAXIMOS_SAIDA) {
    return recusado("a foto comprimida ainda passa de 2 MB");
  }

  return OK;
}

export function dimensoesAlvo(
  largura: number,
  altura: number,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);

  if (maior <= LADO_MAXIMO) {
    return { largura, altura };
  }

  const fator = LADO_MAXIMO / maior;

  return {
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  };
}

export function validarQuantidade(exigidas: number, enviadas: number): Avaliacao {
  if (enviadas > FOTOS_MAXIMAS) {
    return recusado(`a tarefa aceita no máximo ${FOTOS_MAXIMAS} fotos`);
  }

  if (enviadas < exigidas) {
    return recusado(
      `faltam fotos: a tarefa exige ${exigidas} e foram enviadas ${enviadas}`,
    );
  }

  return OK;
}

/**
 * Conversao para WebP. Depende de canvas, entao roda apenas no navegador; o
 * servidor recebe o resultado ja pronto.
 */
export async function comprimirParaWebp(
  original: Blob,
  qualidade = 0.82,
): Promise<{ conteudo: Blob; largura: number; altura: number }> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    throw new Error("a compressão de imagem só roda no navegador");
  }

  const bitmap = await createImageBitmap(original);
  const alvo = dimensoesAlvo(bitmap.width, bitmap.height);
  const tela = new OffscreenCanvas(alvo.largura, alvo.altura);
  const contexto = tela.getContext("2d");

  if (!contexto) {
    throw new Error("não foi possível preparar a imagem");
  }

  contexto.drawImage(bitmap, 0, 0, alvo.largura, alvo.altura);
  bitmap.close();

  const conteudo = await tela.convertToBlob({ type: TIPO_DE_SAIDA, quality: qualidade });

  return { conteudo, largura: alvo.largura, altura: alvo.altura };
}
