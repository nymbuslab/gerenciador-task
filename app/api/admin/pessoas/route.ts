import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  cadastrarFuncionario,
  redefinirPin,
  type ClientesAdministrativos,
} from "@/src/features/administration/team-service";
import { readSupabaseAdminEnv } from "@/src/lib/env";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "cache-control": "no-store" };

/**
 * Operacoes administrativas que a RLS sozinha nao alcanca: criar a identidade
 * do funcionario e trocar o segredo dela. O restante da administracao acontece
 * direto do navegador, com a sessao do gestor e a politica do banco decidindo.
 */
function montarClientes(request: Request): ClientesAdministrativos | null {
  const autorizacao = request.headers.get("authorization");

  if (!autorizacao?.startsWith("Bearer ")) {
    return null;
  }

  const env = readSupabaseAdminEnv();

  const comoAtor: SupabaseClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: autorizacao } },
    },
  );

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  return { comoAtor, admin };
}

function resposta(resultado: { situacao: string }): Response {
  const status = resultado.situacao === "ok" ? 201 : resultado.situacao === "negado" ? 403 : 422;

  return Response.json(resultado, { status, headers: SEM_CACHE });
}

export async function POST(request: Request) {
  const clientes = montarClientes(request);

  if (!clientes) {
    return Response.json({ situacao: "negado" }, { status: 401, headers: SEM_CACHE });
  }

  const corpo = await request.json().catch(() => null);

  return resposta(await cadastrarFuncionario(clientes, corpo));
}

export async function PATCH(request: Request) {
  const clientes = montarClientes(request);

  if (!clientes) {
    return Response.json({ situacao: "negado" }, { status: 401, headers: SEM_CACHE });
  }

  const corpo = (await request.json().catch(() => null)) as
    | { perfilId?: string; pin?: string }
    | null;

  if (!corpo?.perfilId || typeof corpo.pin !== "string") {
    return Response.json(
      { situacao: "invalido", motivos: ["perfil e PIN sao obrigatorios"] },
      { status: 422, headers: SEM_CACHE },
    );
  }

  const resultado = await redefinirPin(clientes, corpo.perfilId, corpo.pin);

  return Response.json(resultado, {
    status: resultado.situacao === "ok" ? 200 : resultado.situacao === "negado" ? 403 : 422,
    headers: SEM_CACHE,
  });
}
