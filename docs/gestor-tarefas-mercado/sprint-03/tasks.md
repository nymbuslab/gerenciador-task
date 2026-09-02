# Tasks — Sprint 03

```yaml
id: T-03.01
titulo: Schema e RLS de tarefas
objetivo: Persistir modelos, ocorrências, destinatários, execuções, checklist e auditoria.
arquivos:
  cria: [supabase/migrations/00000000000003_tasks.sql, tests/integration/tasks-rls.test.ts]
  altera: [tests/fixtures/identities.ts]
teste_integracao: A matriz RLS de tarefas permite somente operações autorizadas por papel, setor e destinatário.
teste_funcional: Um funcionário lista suas tarefas pessoais e coletivas sem receber tarefas inelegíveis.
criterio_aceite: Todos os casos de isolamento e integridade da migration passam.
depende_de: [T-02.06]
paralelizavel: false
status: concluida - 2026-09-01 - suite: integracao 62 passed, 0 failed (18 casos de tarefas: visibilidade por papel, criacao, execucoes, checklist e integridade); typecheck e lint sem erro
```

```yaml
id: T-03.02
titulo: Máquina de estados e atribuição
objetivo: Implementar transições, destinatários coletivos/individuais e tempo ativo/bloqueado.
arquivos:
  cria: [src/features/tasks/domain.ts, src/features/tasks/task-service.ts, tests/unit/task-domain.test.ts, tests/integration/task-transitions.test.ts]
  altera: []
teste_integracao: Comandos válidos persistem uma transição e um evento de auditoria na mesma operação.
teste_funcional: Uma tarefa individual percorre pendente, em execução, bloqueada, retomada e concluída com tempos corretos.
criterio_aceite: Todas as transições permitidas passam e todas as proibidas são rejeitadas.
depende_de: [T-03.01]
paralelizavel: false
status: concluida - 2026-09-01 - suite: unit 27 passed (dominio: transicoes permitidas e proibidas), integracao 70 passed (ciclo completo, auditoria por transicao e conflito de versao); typecheck e lint sem erro
```

```yaml
id: T-03.03
titulo: Evidências privadas e requisitos de conclusão
objetivo: Validar checklist, observação e uma a cinco fotos comprimidas conforme decisão D-24.
arquivos:
  cria: [supabase/migrations/00000000000004_evidence.sql, src/features/execution/evidence-service.ts, src/features/execution/image-compression.ts, tests/integration/evidence.test.ts]
  altera: [src/features/tasks/task-service.ts]
teste_integracao: Upload autorizado grava WebP privado de até 2 MB e associa a evidência à execução correta.
teste_funcional: Arquivo aceito conclui após compressão e arquivo inválido ou requisito ausente impede conclusão.
criterio_aceite: Tipos, limites, quantidade, privacidade e requisitos passam na suíte.
depende_de: [T-03.02]
paralelizavel: true
status: concluida - 2026-09-01 - suite: integracao 77 passed (7 casos de evidencia: WebP privado, limites, isolamento, URL assinada e requisitos), unit 39 passed; typecheck e lint sem erro
```

```yaml
id: T-03.04
titulo: Comentários, menções e validação
objetivo: Implementar conversa contextual, solicitação de validação, aprovação e reprovação.
arquivos:
  cria: [supabase/migrations/00000000000005_collaboration.sql, src/features/collaboration/service.ts, tests/integration/collaboration.test.ts]
  altera: [src/features/tasks/task-service.ts]
teste_integracao: Comentário, menção e decisão de validação respeitam RLS e geram auditoria.
teste_funcional: Uma reprovação justificada devolve a execução ao trabalho e notifica o executor.
criterio_aceite: Comentários, menções, aprovação e reprovação passam para papéis autorizados.
depende_de: [T-03.03]
paralelizavel: false
status: concluida - 2026-09-01 - suite: integracao 85 passed (8 casos de colaboracao: comentario, mencao filtrada por destinatario, aprovacao, reprovacao com aviso ao executor e isolamento da caixa de entrada); typecheck e lint sem erro
```

```yaml
id: T-03.05
titulo: Telas Meu dia, Setor e Operação
objetivo: Entregar as três visões responsivas com criação e execução de tarefas.
arquivos:
  cria: [app/hoje/page.tsx, app/setor/page.tsx, app/operacao/page.tsx, src/features/tasks/components/task-card.tsx, tests/e2e/task-lifecycle.spec.ts]
  altera: [src/components/navigation.tsx]
teste_integracao: As páginas consomem apenas consultas e comandos públicos do módulo de tarefas.
teste_funcional: Gestor cria, funcionário executa e líder valida a mesma tarefa em viewports mobile e desktop.
criterio_aceite: O fluxo ponta a ponta termina com tarefa concluída e histórico completo.
depende_de: [T-03.02]
paralelizavel: true
status: concluida - 2026-09-01 - suite: ci:verify passed; unit/components 46 passed, integracao 85 passed, e2e 23 passed e 5 skipped (ciclo completo em desktop e mobile)
```
