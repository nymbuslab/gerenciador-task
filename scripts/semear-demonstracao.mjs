/**
 * Semeia uma loja de demonstração no Supabase remoto de desenvolvimento.
 *
 * Serve para mostrar o produto funcionando: cobre todos os estados da execução,
 * os três papéis, tarefa coletiva, comentário com menção e caixa de entrada.
 *
 * Rodar com: node scripts/semear-demonstracao.mjs
 *
 * A suíte E2E apaga o banco ao rodar, então este script é o caminho para
 * reconstruir a demonstração em segundos. Contas de pessoas reais que já
 * existam em auth.users são reaproveitadas, e a senha delas não é alterada.
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const LOJA = "Mercado do Bairro";
const DOMINIO_INTERNO = "identidades.interno";

/**
 * A demonstracao vive num dominio proprio. As fixtures de teste usam o dominio
 * de exemplo, e o Supabase recusa e-mail repetido: compartilhar o dominio fazia
 * a semeadura das suites quebrar em cascata.
 */
const DOMINIO_DEMO = "demonstracao.test";

/** Contas de demonstração, recriadas a cada execução. */
const GESTOR_DEMO = {
  nome: "Gestora da Demonstração",
  usuario: "gestora.demo",
  email: "gestor@demonstracao.test",
  segredo: "SenhaDoGestor#2026",
};

/**
 * Instantes ancorados no momento da execução, e não em horas fixas do dia.
 * Com hora fixa, rodar a demonstração à tarde faria metade das tarefas nascer
 * atrasada, e o quadro da liderança contaria um problema que não existe.
 */
function daqui(minutos) {
  return new Date(Date.now() + minutos * 60_000).toISOString();
}

async function limparDemonstracao() {
  for (const tabela of [
    "mentions",
    "comments",
    "notifications",
    "evidence",
    "checklist_items",
    "task_executions",
    "task_recipients",
    "task_occurrences",
    "task_templates",
    "pin_attempts",
    "bootstrap_state",
    "audit_events",
    "memberships",
    "profiles",
    "sectors",
    "stores",
  ]) {
    const coluna = tabela === "pin_attempts" ? "identificador" : "id";
    await admin.from(tabela).delete().not(coluna, "is", null);
  }

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });

  for (const conta of data?.users ?? []) {
    if (
      conta.email?.endsWith(`@${DOMINIO_DEMO}`) ||
      conta.email?.endsWith(`@${DOMINIO_INTERNO}`)
    ) {
      await admin.auth.admin.deleteUser(conta.id);
    }
  }
}

async function contaExistente(email) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data?.users.find((conta) => conta.email === email) ?? null;
}

async function criarPessoa({ lojaId, nome, usuario, email, segredo, papel, setorId }) {
  const jaExiste = await contaExistente(email);
  const conta =
    jaExiste ??
    (await admin.auth.admin.createUser({ email, password: segredo, email_confirm: true })).data
      .user;

  const { data: perfil, error } = await admin
    .from("profiles")
    .insert({ auth_user_id: conta.id, store_id: lojaId, nome, usuario, email })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Falha ao criar o perfil de ${nome}: ${error.message}`);
  }

  await admin.from("memberships").insert({
    profile_id: perfil.id,
    store_id: lojaId,
    sector_id: setorId,
    papel,
  });

  return perfil.id;
}

async function criarTarefa({ lojaId, setorId, criadoPor, tarefa }) {
  const { data: ocorrencia, error } = await admin
    .from("task_occurrences")
    .insert({
      store_id: lojaId,
      sector_id: setorId,
      titulo: tarefa.titulo,
      instrucoes: tarefa.instrucoes ?? null,
      publico: "setor",
      modo_conclusao: tarefa.compartilhada ? "coletiva" : "individual",
      prioridade: tarefa.prioridade ?? "normal",
      prazo: tarefa.prazo ?? null,
      exige_aprovacao: tarefa.exigeAprovacao ?? false,
      criado_por: criadoPor,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Falha ao criar "${tarefa.titulo}": ${error.message}`);
  }

  for (const perfilId of tarefa.destinatarios) {
    await admin
      .from("task_recipients")
      .insert({ occurrence_id: ocorrencia.id, profile_id: perfilId });
  }

  const { data: execucao } = await admin
    .from("task_executions")
    .insert({
      occurrence_id: ocorrencia.id,
      store_id: lojaId,
      sector_id: setorId,
      responsavel_perfil_id: tarefa.compartilhada ? null : tarefa.responsavel,
      compartilhada: tarefa.compartilhada ?? false,
      estado: tarefa.estado,
      iniciada_em: tarefa.iniciadaEm ?? null,
      faixa_ativa_desde: tarefa.estado === "em_execucao" ? tarefa.iniciadaEm : null,
      bloqueada_em: tarefa.estado === "bloqueada" ? tarefa.bloqueadaEm : null,
      bloqueio_motivo: tarefa.estado === "bloqueada" ? tarefa.bloqueioMotivo : null,
      segundos_ativos: tarefa.segundosAtivos ?? 0,
      segundos_bloqueados: tarefa.segundosBloqueados ?? 0,
      validacao_solicitada_em:
        tarefa.estado === "aguardando_validacao" ? tarefa.validacaoEm : null,
      concluida_em: tarefa.estado === "concluida" ? tarefa.concluidaEm : null,
    })
    .select("id")
    .single();

  return { ocorrenciaId: ocorrencia.id, execucaoId: execucao.id };
}

async function semear() {
  await limparDemonstracao();

  const { data: loja } = await admin.from("stores").insert({ nome: LOJA }).select("id").single();

  const setores = {};
  for (const nome of ["Mercearia", "Açougue", "Padaria", "Frente de caixa"]) {
    const { data } = await admin
      .from("sectors")
      .insert({ store_id: loja.id, nome })
      .select("id")
      .single();
    setores[nome] = data.id;
  }

  // A conta do responsável pelo projeto, se já existir em auth.users, volta a
  // ser gestora da loja com a senha que ela mesma escolheu.
  const pessoal = await contaExistente("pabllomoliveiraa@gmail.com");
  if (pessoal) {
    const { data: perfil } = await admin
      .from("profiles")
      .insert({
        auth_user_id: pessoal.id,
        store_id: loja.id,
        nome: "Pabllo Martins",
        usuario: "pabllo.martins",
        email: pessoal.email,
      })
      .select("id")
      .single();
    await admin.from("memberships").insert({
      profile_id: perfil.id,
      store_id: loja.id,
      sector_id: null,
      papel: "gestor",
    });
  }

  const gestora = await criarPessoa({
    lojaId: loja.id,
    ...GESTOR_DEMO,
    papel: "gestor",
    setorId: null,
  });

  const lucia = await criarPessoa({
    lojaId: loja.id,
    nome: "Lúcia Martins",
    usuario: "lucia.martins",
    email: "lider.mercearia@demonstracao.test",
    segredo: "SenhaDaLider#2026",
    papel: "lider",
    setorId: setores.Mercearia,
  });

  const rogerio = await criarPessoa({
    lojaId: loja.id,
    nome: "Rogério Pinto",
    usuario: "rogerio.pinto",
    email: "lider.acougue@demonstracao.test",
    segredo: "SenhaDoLider#2026",
    papel: "lider",
    setorId: setores["Açougue"],
  });

  const equipe = {};
  for (const pessoa of [
    { nome: "Fábio Reposição", usuario: "fabio.reposicao", pin: "123456", setor: "Mercearia" },
    { nome: "Camila Souza", usuario: "camila.souza", pin: "234567", setor: "Mercearia" },
    { nome: "Marina Corte", usuario: "marina.corte", pin: "654321", setor: "Açougue" },
    { nome: "Tiago Forno", usuario: "tiago.forno", pin: "345678", setor: "Padaria" },
  ]) {
    equipe[pessoa.usuario] = await criarPessoa({
      lojaId: loja.id,
      nome: pessoa.nome,
      usuario: pessoa.usuario,
      email: `${pessoa.usuario}@${DOMINIO_INTERNO}`,
      segredo: pessoa.pin,
      papel: "funcionario",
      setorId: setores[pessoa.setor],
    });
  }

  await admin.from("bootstrap_state").insert({ id: true, store_id: loja.id });

  // Um dia de loja com todos os estados aparecendo em tela.
  const emAndamento = await criarTarefa({
    lojaId: loja.id,
    setorId: setores.Mercearia,
    criadoPor: lucia,
    tarefa: {
      titulo: "Repor a gôndola de bebidas",
      instrucoes: "Comece pelo corredor central. Deixe as caixas vazias na doca, não no corredor.",
      prazo: daqui(75),
      estado: "em_execucao",
      iniciadaEm: daqui(-12),
      segundosAtivos: 720,
      responsavel: equipe["fabio.reposicao"],
      destinatarios: [equipe["fabio.reposicao"]],
    },
  });

  await criarTarefa({
    lojaId: loja.id,
    setorId: setores.Mercearia,
    criadoPor: lucia,
    tarefa: {
      titulo: "Conferir validade do laticínio",
      prazo: daqui(150),
      prioridade: "alta",
      estado: "pendente",
      responsavel: equipe["fabio.reposicao"],
      destinatarios: [equipe["fabio.reposicao"]],
    },
  });

  const emValidacao = await criarTarefa({
    lojaId: loja.id,
    setorId: setores.Mercearia,
    criadoPor: lucia,
    tarefa: {
      titulo: "Trocar etiquetas do corredor 3",
      instrucoes: "Confira o preço no sistema antes de imprimir a etiqueta.",
      prazo: daqui(240),
      exigeAprovacao: true,
      estado: "aguardando_validacao",
      iniciadaEm: daqui(-90),
      validacaoEm: daqui(-45),
      segundosAtivos: 2700,
      responsavel: equipe["fabio.reposicao"],
      destinatarios: [equipe["fabio.reposicao"]],
    },
  });

  await criarTarefa({
    lojaId: loja.id,
    setorId: setores.Mercearia,
    criadoPor: lucia,
    tarefa: {
      titulo: "Abrir o corredor central",
      estado: "concluida",
      iniciadaEm: daqui(-320),
      concluidaEm: daqui(-305),
      segundosAtivos: 900,
      responsavel: equipe["fabio.reposicao"],
      destinatarios: [equipe["fabio.reposicao"]],
    },
  });

  await criarTarefa({
    lojaId: loja.id,
    setorId: setores.Mercearia,
    criadoPor: lucia,
    tarefa: {
      titulo: "Limpeza do corredor central",
      instrucoes: "Quem chegar primeiro assume. A primeira conclusão encerra para o setor.",
      prazo: daqui(360),
      compartilhada: true,
      estado: "pendente",
      destinatarios: [equipe["fabio.reposicao"], equipe["camila.souza"]],
    },
  });

  await criarTarefa({
    lojaId: loja.id,
    setorId: setores["Açougue"],
    criadoPor: rogerio,
    tarefa: {
      titulo: "Higienizar a serra de corte",
      prazo: daqui(195),
      prioridade: "alta",
      estado: "bloqueada",
      iniciadaEm: daqui(-85),
      bloqueadaEm: daqui(-60),
      bloqueioMotivo: "Falta o detergente próprio. Pedido já feito ao depósito.",
      segundosAtivos: 1500,
      segundosBloqueados: 3600,
      responsavel: equipe["marina.corte"],
      destinatarios: [equipe["marina.corte"]],
    },
  });

  await criarTarefa({
    lojaId: loja.id,
    setorId: setores["Açougue"],
    criadoPor: rogerio,
    tarefa: {
      titulo: "Conferir a câmara fria",
      estado: "concluida",
      iniciadaEm: daqui(-380),
      concluidaEm: daqui(-355),
      segundosAtivos: 1500,
      responsavel: equipe["marina.corte"],
      destinatarios: [equipe["marina.corte"]],
    },
  });

  // Prazo no passado: entra como atrasada nos indicadores da liderança.
  await criarTarefa({
    lojaId: loja.id,
    setorId: setores.Padaria,
    criadoPor: gestora,
    tarefa: {
      titulo: "Repor os pães na estufa",
      prazo: daqui(-120),
      prioridade: "alta",
      estado: "pendente",
      responsavel: equipe["tiago.forno"],
      destinatarios: [equipe["tiago.forno"]],
    },
  });

  // Conversa dentro da tarefa, com menção e o aviso que ela gera.
  await admin
    .from("comments")
    .insert({
      occurrence_id: emAndamento.ocorrenciaId,
      execution_id: emAndamento.execucaoId,
      store_id: loja.id,
      autor_perfil_id: equipe["fabio.reposicao"],
      texto: "Comecei pela ponta do corredor. O refrigerante de 2 litros acabou no estoque.",
    });

  const { data: resposta } = await admin
    .from("comments")
    .insert({
      occurrence_id: emAndamento.ocorrenciaId,
      execution_id: emAndamento.execucaoId,
      store_id: loja.id,
      autor_perfil_id: lucia,
      texto: "Obrigada pelo aviso. Pode seguir com o resto que eu peço reposição ao depósito.",
    })
    .select("id")
    .single();

  await admin.from("mentions").insert({
    comment_id: resposta.id,
    profile_id: equipe["fabio.reposicao"],
  });

  await admin.from("notifications").insert([
    {
      store_id: loja.id,
      destinatario_perfil_id: equipe["fabio.reposicao"],
      tipo: "mencao",
      titulo: "Você foi citado em Repor a gôndola de bebidas",
      corpo: "Obrigada pelo aviso. Pode seguir com o resto que eu peço reposição ao depósito.",
      entidade: "comments",
      entidade_id: resposta.id,
    },
    {
      store_id: loja.id,
      destinatario_perfil_id: equipe["fabio.reposicao"],
      tipo: "validacao_reprovar",
      titulo: "Tarefa devolvida: Conferir o corredor 7",
      corpo: "Faltou a etiqueta da prateleira de baixo.",
      entidade: "task_executions",
      entidade_id: emValidacao.execucaoId,
      lida_em: daqui(-70),
    },
    {
      store_id: loja.id,
      destinatario_perfil_id: equipe["marina.corte"],
      tipo: "tarefa_atribuida",
      titulo: "Nova tarefa: Higienizar a serra de corte",
      entidade: "task_executions",
      entidade_id: null,
    },
  ]);

  const { count: tarefas } = await admin
    .from("task_executions")
    .select("id", { count: "exact", head: true });

  console.log(`Loja "${LOJA}" semeada.`);
  console.log(`  4 setores, 7 pessoas${pessoal ? " (incluindo a sua conta como gestor)" : ""}.`);
  console.log(`  ${tarefas} tarefas, cobrindo todos os estados.`);
  console.log(`  2 comentários com menção e 3 avisos na caixa de entrada.`);
  console.log("");
  console.log("Acessos:");
  console.log(`  Liderança  ${GESTOR_DEMO.email} / ${GESTOR_DEMO.segredo}   (gestor)`);
  console.log("  Liderança  lider.mercearia@demonstracao.test / SenhaDaLider#2026");
  console.log("  Liderança  lider.acougue@demonstracao.test / SenhaDoLider#2026");
  console.log("  Funcionário  fabio.reposicao / PIN 123456");
  console.log("  Funcionário  camila.souza / PIN 234567");
  console.log("  Funcionário  marina.corte / PIN 654321");
  console.log("  Funcionário  tiago.forno / PIN 345678");
  if (pessoal) {
    console.log(`  Liderança  ${pessoal.email} / a senha que você escolheu   (gestor)`);
  }
}

semear().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
