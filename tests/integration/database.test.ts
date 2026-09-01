import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("Supabase remoto de desenvolvimento", () => {
  it("aplica RLS para cliente anônimo e permite limpeza pela Service Role", async () => {
    expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
    expect(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente").toBeTruthy();
    expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

    const fixtureId = crypto.randomUUID();
    const admin = createClient(url!, serviceRoleKey!, {
      auth: { persistSession: false },
    });
    const anonymous = createClient(url!, anonKey!, {
      auth: { persistSession: false },
    });

    const { error: insertError } = await admin
      .from("integration_probe")
      .insert({ id: fixtureId });
    expect(insertError).toBeNull();

    try {
      const { data, error } = await anonymous
        .from("integration_probe")
        .select("id")
        .eq("id", fixtureId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    } finally {
      const { error: deleteError } = await admin
        .from("integration_probe")
        .delete()
        .eq("id", fixtureId);
      expect(deleteError).toBeNull();
    }
  });
});
