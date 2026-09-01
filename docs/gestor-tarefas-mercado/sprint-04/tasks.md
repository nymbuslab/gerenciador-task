# Tasks — Sprint 04

```yaml
id: T-04.01
titulo: Schema e gestão de escala
objetivo: Implementar turnos, folgas e substituições com RLS por loja e setor.
arquivos:
  cria: [supabase/migrations/00000000000006_shifts.sql, src/features/scheduling/service.ts, tests/integration/shifts.test.ts]
  altera: []
teste_integracao: Gestor administra toda a escala e líder somente a do próprio setor.
teste_funcional: Uma substituição remove o titular e torna o substituto elegível no período.
criterio_aceite: Turno, folga, substituição e matriz RLS passam na suíte.
depende_de: [T-03.05]
paralelizavel: true
status: pendente
```

```yaml
id: T-04.02
titulo: Modelos e job de recorrência
objetivo: Gerar ocorrências diárias, semanais e em dias específicos sem duplicação.
arquivos:
  cria: [supabase/migrations/00000000000007_recurrence.sql, src/features/tasks/recurrence-service.ts, tests/integration/recurrence.test.ts]
  altera: [src/features/tasks/task-service.ts]
teste_integracao: Executar o job duas vezes gera uma única ocorrência por modelo e referência.
teste_funcional: Alterar um modelo mantém a ocorrência existente e aplica a mudança à próxima geração.
criterio_aceite: Frequências, idempotência e imutabilidade histórica passam na suíte.
depende_de: [T-03.05]
paralelizavel: true
status: pendente
```

```yaml
id: T-04.03
titulo: Elegibilidade e fila do setor
objetivo: Cruzar recorrência e escala para atribuir ou enfileirar ocorrências.
arquivos:
  cria: [src/features/scheduling/eligibility-service.ts, tests/integration/assignment-eligibility.test.ts]
  altera: [src/features/tasks/recurrence-service.ts]
teste_integracao: Ocorrência de responsável não escalado persiste sem responsável e com setor correto.
teste_funcional: O líder encontra a tarefa na fila e a reatribui a um funcionário escalado.
criterio_aceite: Casos presente, folga e substituição produzem o responsável esperado.
depende_de: [T-04.01, T-04.02]
paralelizavel: false
status: pendente
```

```yaml
id: T-04.04
titulo: Interfaces de escala e recorrência
objetivo: Entregar calendário de escala, editor de modelos e fila sem responsável.
arquivos:
  cria: [app/escala/page.tsx, app/rotinas/page.tsx, src/features/scheduling/components/shift-calendar.tsx, tests/e2e/scheduling.spec.ts]
  altera: [app/setor/page.tsx, src/components/navigation.tsx]
teste_integracao: As telas usam os serviços de escala e recorrência sem acesso direto às tabelas.
teste_funcional: Gestor cria rotina, agenda folga e líder reatribui a ocorrência gerada na fila.
criterio_aceite: O cenário completo de ausência e reatribuição passa em mobile e desktop.
depende_de: [T-04.03]
paralelizavel: false
status: pendente
```

