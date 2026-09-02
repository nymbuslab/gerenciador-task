"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente do navegador, com a chave anonima e sujeito a RLS. A sessao fica
 * guardada por identidade no proprio aparelho; um unico cliente por aba evita
 * duas copias do estado de sessao conversando com o mesmo armazenamento.
 */
let cliente: SupabaseClient | null = null;

export function supabaseDoNavegador(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, storageKey: "gestor-tarefas-sessao" } },
    );
  }

  return cliente;
}
