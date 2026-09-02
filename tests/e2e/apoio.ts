import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Apoio comum dos specs que precisam de loja, equipe e sessao de verdade.
 * Cada spec semeia e limpa a propria loja; o Playwright roda com um worker so
 * justamente porque todos compartilham o mesmo Supabase remoto.
 */

export type PessoaDeTeste = {
  nome: string;
  usuario: string;
  email: string;
  segredo: string;
};

export function clienteAdministrativo(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  expect(url, "NEXT_PUBLIC_SUPABASE_URL ausente").toBeTruthy();
  expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY ausente").toBeTruthy();

  return createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });
}

export async function limparLoja(admin: SupabaseClient): Promise<void> {
  await admin.from("mentions").delete().not("id", "is", null);
  await admin.from("comments").delete().not("id", "is", null);
  await admin.from("notifications").delete().not("id", "is", null);
  await admin.from("evidence").delete().not("id", "is", null);
  await admin.from("checklist_items").delete().not("id", "is", null);
  await admin.from("task_executions").delete().not("id", "is", null);
  await admin.from("task_recipients").delete().not("id", "is", null);
  await admin.from("task_occurrences").delete().not("id", "is", null);
  await admin.from("pin_attempts").delete().not("identificador", "is", null);
  await admin.from("bootstrap_state").delete().eq("id", true);
  await admin.from("audit_events").delete().not("id", "is", null);
  await admin.from("memberships").delete().not("id", "is", null);
  await admin.from("profiles").delete().not("id", "is", null);
  await admin.from("sectors").delete().not("id", "is", null);
  await admin.from("stores").delete().not("id", "is", null);

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });

  // A demonstração entra na limpeza junto com as fixtures: os testes apagam
  // todas as lojas, e deixar a conta viva sem perfil produz um acesso que
  // autentica e recusa sem explicar o motivo.
  const DESCARTAVEIS = ["@example.test", "@demonstracao.test", "@identidades.interno"];

  for (const conta of data?.users ?? []) {
    if (DESCARTAVEIS.some((dominio) => conta.email?.endsWith(dominio))) {
      await admin.auth.admin.deleteUser(conta.id);
    }
  }
}

export async function criarPessoa(
  admin: SupabaseClient,
  lojaId: string,
  pessoa: PessoaDeTeste,
  papel: "gestor" | "lider" | "funcionario",
  setorId: string | null,
): Promise<string> {
  const { data: conta } = await admin.auth.admin.createUser({
    email: pessoa.email,
    password: pessoa.segredo,
    email_confirm: true,
  });

  const { data: perfil } = await admin
    .from("profiles")
    .insert({
      auth_user_id: conta!.user!.id,
      store_id: lojaId,
      nome: pessoa.nome,
      usuario: pessoa.usuario,
      email: pessoa.email,
    })
    .select("id")
    .single();

  await admin.from("memberships").insert({
    profile_id: perfil!.id,
    store_id: lojaId,
    sector_id: setorId,
    papel,
  });

  return perfil!.id;
}

export async function criarLojaComSetor(
  admin: SupabaseClient,
  nomeDaLoja: string,
  nomeDoSetor: string,
): Promise<{ lojaId: string; setorId: string }> {
  const { data: loja } = await admin
    .from("stores")
    .insert({ nome: nomeDaLoja })
    .select("id")
    .single();

  const { data: setor } = await admin
    .from("sectors")
    .insert({ store_id: loja!.id, nome: nomeDoSetor })
    .select("id")
    .single();

  return { lojaId: loja!.id, setorId: setor!.id };
}

/** O PIN e digitado em seis casas separadas, uma por digito. */
export async function preencherPin(pagina: Page, pin: string): Promise<void> {
  for (let posicao = 0; posicao < pin.length; posicao += 1) {
    await pagina.getByLabel(`Dígito ${posicao + 1} de 6`).fill(pin[posicao]);
  }
}

export async function entrar(
  browser: Browser,
  identificador: string,
  segredo: string,
  comoLideranca: boolean,
): Promise<Page> {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();

  await pagina.goto("/");

  if (comoLideranca) {
    await pagina.getByRole("button", { name: "Liderança" }).click();
    await pagina.getByLabel("E-mail", { exact: true }).fill(identificador);
    await pagina.getByLabel("Senha", { exact: true }).fill(segredo);
  } else {
    await pagina.getByLabel("Usuário", { exact: true }).fill(identificador);
    await preencherPin(pagina, segredo);
  }

  await pagina.getByRole("button", { name: "Entrar", exact: true }).click();

  // A primeira chamada ao servidor recem-iniciado passa dos 5 segundos padrao
  // do Playwright, entao a espera pela visao do papel e explicita e generosa.
  await pagina.waitForURL(/\/(hoje|setor|operacao)$/, { timeout: 30_000 });

  return pagina;
}
