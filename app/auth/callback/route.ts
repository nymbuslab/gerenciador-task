import { createClient } from "@supabase/supabase-js";

import { autenticar } from "@/src/features/identity/auth-service";
import { readSupabaseAdminEnv } from "@/src/lib/env";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "cache-control": "no-store" };

/**
 * Conclui o login no servidor. A resolucao de usuario para identidade interna
 * usa a Service Role, que nunca sai daqui; a sessao aberta volta ao navegador
 * apenas como par de tokens, sem revelar o e-mail interno do funcionario.
 */
export async function POST(request: Request) {
  let corpo: unknown;

  try {
    corpo = await request.json();
  } catch {
    return Response.json(
      { situacao: "negado", motivo: "Usuário ou senha incorretos." },
      { status: 400, headers: SEM_CACHE },
    );
  }

  const entrada = corpo as { identificador?: unknown; segredo?: unknown };

  if (typeof entrada.identificador !== "string" || typeof entrada.segredo !== "string") {
    return Response.json(
      { situacao: "negado", motivo: "Usuário ou senha incorretos." },
      { status: 400, headers: SEM_CACHE },
    );
  }

  const env = readSupabaseAdminEnv();

  const clienteAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const clientePublico = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const resultado = await autenticar(
    { admin: clienteAdmin, publico: clientePublico },
    { identificador: entrada.identificador, segredo: entrada.segredo },
  );

  if (resultado.situacao === "bloqueado") {
    return Response.json(resultado, { status: 429, headers: SEM_CACHE });
  }

  if (resultado.situacao === "negado") {
    return Response.json(resultado, { status: 401, headers: SEM_CACHE });
  }

  const { data } = await clientePublico.auth.getSession();

  if (!data.session) {
    return Response.json(
      { situacao: "negado", motivo: "Usuário ou senha incorretos." },
      { status: 401, headers: SEM_CACHE },
    );
  }

  return Response.json(
    {
      situacao: "autenticado",
      destino: resultado.destino,
      nome: resultado.sessao.nome,
      papel: resultado.sessao.papel,
      tokens: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    },
    { headers: SEM_CACHE },
  );
}
