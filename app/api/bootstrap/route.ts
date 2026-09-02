import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  bootstrapDisponivel,
  executarBootstrap,
} from "@/src/features/administration/bootstrap-service";
import { readSupabaseAdminEnv } from "@/src/lib/env";

export const dynamic = "force-dynamic";

/**
 * Rota do assistente de configuracao inicial. A Service Role vive apenas aqui:
 * o navegador nunca a recebe e nunca chama o banco administrativo direto.
 */
function clienteAdministrativo(): SupabaseClient {
  const env = readSupabaseAdminEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  try {
    const disponivel = await bootstrapDisponivel(clienteAdministrativo());

    return Response.json({ disponivel }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ erro: "consulta indisponivel" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let corpo: unknown;

  try {
    corpo = await request.json();
  } catch {
    return Response.json({ situacao: "invalido", motivos: ["corpo invalido"] }, { status: 400 });
  }

  let resultado;

  try {
    resultado = await executarBootstrap(clienteAdministrativo(), corpo);
  } catch {
    return Response.json({ situacao: "falha" }, { status: 503 });
  }

  switch (resultado.situacao) {
    case "concluido":
      return Response.json({ situacao: "concluido" }, { status: 201 });
    case "indisponivel":
      return Response.json({ situacao: "indisponivel" }, { status: 409 });
    case "invalido":
      return Response.json(resultado, { status: 422 });
    default:
      return Response.json({ situacao: "falha" }, { status: 503 });
  }
}
