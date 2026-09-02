import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().min(1),
});

const supabaseAdminSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function readPublicEnv(source: NodeJS.ProcessEnv = process.env) {
  return publicSchema.parse(source);
}

/**
 * Leitura estreita para quem so precisa falar com o Supabase pelo servidor.
 * Exigir o conjunto completo aqui acoplaria a configuracao inicial as chaves de
 * Web Push, que pertencem a outra etapa e ainda nao existem.
 */
export function readSupabaseAdminEnv(source: NodeJS.ProcessEnv = process.env) {
  return supabaseAdminSchema.parse(source);
}

export function readServerEnv(source: NodeJS.ProcessEnv = process.env) {
  return serverSchema.parse(source);
}
