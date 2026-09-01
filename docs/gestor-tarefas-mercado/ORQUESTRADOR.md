# Orquestrador — gestor-tarefas-mercado

> Porta de entrada da execução. Use somente caminhos relativos e nunca registre valores de segredos.

## 1. Objetivo

Entregar uma PWA mobile-first para distribuir, executar e auditar tarefas de uma loja de mercado. Funcionários operam o próprio dia, líderes gerenciam seu setor e o gestor acompanha toda a loja. O MVP inclui recorrência, escala, evidências, offline, notificações e indicadores, validado em piloto de 14 dias.

## 2. Mapa e ordem de leitura

1. `docs/gestor-tarefas-mercado/ORQUESTRADOR.md`
2. `docs/gestor-tarefas-mercado/00-DECISOES.md`
3. `docs/gestor-tarefas-mercado/base/00-INDICE.md` e todos os arquivos listados nele
4. `PRD.md` e `docs/README.md`
5. `docs/gestor-tarefas-mercado/sprint-01/sprint.md` → `fases.md` → `tasks.md`
6. Repetir a ordem anterior para `sprint-02/` até `sprint-06/`
7. `docs/gestor-tarefas-mercado/00-BLOQUEIOS.md`
8. `docs/gestor-tarefas-mercado/00-AUDITORIA.md`

## 3. Rota de execução

- Sprint 01: F-01.1 → F-01.2 ∥ F-01.3 → gate da sprint.
- Sprint 02: F-02.1 ∥ F-02.2 → F-02.3 → gate da sprint.
- Sprint 03: F-03.1 → F-03.2 ∥ F-03.3 → gate da sprint.
- Sprint 04: F-04.1 ∥ F-04.2 → F-04.3 → gate da sprint.
- Sprint 05: F-05.1 ∥ F-05.2 → F-05.3 → gate da sprint.
- Sprint 06: F-06.1 ∥ F-06.2 → F-06.3 → gate global.

Sprints são sequenciais. Dentro de cada fase, obedecer `depende_de` e `paralelizavel` declarados nos respectivos `tasks.md`.

**Caminho crítico estrutural:** T-01.01 → T-01.02/T-01.03/T-01.04 → T-01.05 → T-02.01/T-02.02 → T-02.05 → T-02.03 → T-02.04 → T-02.06 → T-03.01 → T-03.02 → T-03.03 → T-03.04 + gate T-03.05 → T-04.01/T-04.02 → T-04.03 → T-04.04 → T-05.01/T-05.02 → T-05.03/T-05.04 → T-05.05 → T-06.01/T-06.02/T-06.03 → T-06.04 → T-06.05.

## 4. Ferramentas

- **MCPs / SDKs planejados:** Next.js/React para aplicação; Supabase CLI e SDK para Auth, PostgreSQL, Storage e Realtime; Playwright para navegador; Vitest e Testing Library para testes.
- **Gerenciador:** pnpm 11.25.0 via Corepack, fixado em `package.json` e `pnpm-lock.yaml`.
- **Testes:** `corepack pnpm test`, `corepack pnpm test:coverage` e `corepack pnpm test:e2e`; bootstrap usa `powershell -NoProfile -ExecutionPolicy Bypass -File tests/scaffold/scaffold.test.ps1` e `tests/scaffold/home.test.ps1`.
- **Lint:** `corepack pnpm lint`.
- **Typecheck:** `corepack pnpm typecheck`.
- **Segredos:** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local` e variáveis da Vercel; `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` somente no ambiente de servidor e secret manager; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` em `.env.local` e Vercel. Valores nunca entram no repositório.
- **Pré-requisito externo de T-06.04:** contas Vercel e Supabase com credenciais disponíveis no secret manager/CI antes de iniciar a task; se ausentes, registrar bloqueio sem pedir credenciais em texto.

## 5. Agentes

- **Implementador:** escreve primeiro os testes de integração e funcional, confirma a falha, implementa e obtém verde.
- **Revisor de testes:** confirma que os testes falhariam com implementação incorreta e rejeita falso positivo.
- **Auditor de aceite:** executa e comprova o `criterio_aceite` antes de permitir `status: concluida`.

**Agente único:** assume implementador, revisor de testes e auditor de aceite nessa ordem dentro de cada task; cada papel é um portão obrigatório.

## 6. Regras de autonomia

1. Não perguntar nem pedir autorização durante a execução.
2. Escrever o teste antes do código.
3. Marcar uma task `concluida` somente com teste de integração, teste funcional e critério de aceite aprovados.
4. Registrar dúvida ou pré-requisito faltante em `docs/gestor-tarefas-mercado/00-BLOQUEIOS.md` no formato `B-NN | task | bloqueio | o que destravaria`, marcar a task `bloqueada` e seguir para a próxima paralelizável.
5. Executar em paralelo somente o que o plano declarou.
6. Atualizar `status` no `tasks.md` correspondente em cada transição; ao concluir, acrescentar data e resultado da suíte.
7. Não avançar quando o critério de saída de task, fase ou sprint não estiver atendido.

## 7. Definição de pronto global

- Todos os 30 contratos de task estão `concluida` com testes e aceite registrados.
- Todos os gates das seis sprints terminam com código 0 ou checklist binário aprovado.
- Gestor, líder e funcionário concluem a história completa em mobile e desktop.
- RLS impede acesso cruzado entre pessoas e setores.
- Fluxo offline reconecta sem perda, duplicação ou sobrescrita silenciosa.
- Evidências privadas, retenção, jobs, notificações e CSV passam nos testes definidos.
- Backup de homologação é restaurado e validado.
- O painel permite ao gestor configurar setor, participantes, período, suporte e critérios de interrupção do piloto.
- A entrega técnica está implantada e pronta para o piloto; após a entrega, o aceite operacional exige 14 dias sem perda de dados, violação de permissão ou falha crítica.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em cada `docs/gestor-tarefas-mercado/sprint-NN/tasks.md`.
3. Leia `docs/gestor-tarefas-mercado/00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências estejam todas `concluida`; ignore tasks `bloqueada` até o bloqueio registrado ser resolvido.
