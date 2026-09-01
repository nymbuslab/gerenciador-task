# Tasks — Sprint 06

```yaml
id: T-06.01
titulo: Indicadores e exportação CSV
objetivo: Calcular operação, gargalos e duração com filtros e exportação equivalente.
arquivos:
  cria: [src/features/reporting/queries.ts, app/relatorios/page.tsx, app/api/reports/export/route.ts, tests/integration/reporting.test.ts, tests/e2e/reports.spec.ts]
  altera: [src/components/navigation.tsx]
teste_integracao: Fixtures conhecidas produzem totais iguais na consulta do painel e no CSV autorizado.
teste_funcional: Gestor filtra setor/período e baixa CSV com as mesmas linhas exibidas.
criterio_aceite: Previstas, prazo, bloqueio, duração ativa e cancelamentos passam em todos os casos de referência.
depende_de: [T-05.05]
paralelizavel: true
status: pendente
```

```yaml
id: T-06.02
titulo: Retenção e anonimização
objetivo: Remover fotos e anonimizar dados pessoais após 12 meses preservando agregados.
arquivos:
  cria: [supabase/migrations/00000000000011_retention.sql, src/features/operations/retention-job.ts, tests/integration/retention.test.ts]
  altera: []
teste_integracao: Registros vencidos perdem arquivos e identidade pessoal sem alterar métricas agregadas.
teste_funcional: Um registro com menos de 12 meses permanece e um vencido deixa de expor foto ou pessoa.
criterio_aceite: Casos antes, no limite e após retenção passam sem órfãos no Storage.
depende_de: [T-05.05]
paralelizavel: true
status: pendente
```

```yaml
id: T-06.03
titulo: Observabilidade, backup e recuperação
objetivo: Monitorar jobs/sync/uploads e comprovar backup e restauração no Supabase remoto de desenvolvimento.
arquivos:
  cria: [src/lib/observability.ts, docs/runbook.md, tests/operations/recovery.test.md]
  altera: [docs/deployment.md, .env.example]
teste_integracao: Falha simulada de job gera evento correlacionado sem segredo e nova tentativa controlada.
teste_funcional: O roteiro exporta, remove e restaura uma base local e valida registros e políticas RLS.
criterio_aceite: Alertas definidos disparam e o ensaio de restauração termina com checklist aprovado.
depende_de: [T-05.05]
paralelizavel: true
status: pendente
```

```yaml
id: T-06.04
titulo: Provisionamento e deploy hospedado
objetivo: Configurar Preview e Produção na Vercel/Supabase com migrations, segredos e smoke test.
arquivos:
  cria: [vercel.json, scripts/deploy-smoke.ts, docs/deployment-checklist.md]
  altera: [.env.example, docs/deployment.md]
teste_integracao: O deploy aplica migrations e o smoke valida aplicação, banco, Storage e job sem expor segredos.
teste_funcional: As URLs de Preview e Produção respondem ao health check e permitem onboarding somente onde não há gestor.
criterio_aceite: Preview e Produção concluem deploy e smoke com código 0 e rollback documentado.
depende_de: [T-06.01, T-06.02, T-06.03]
paralelizavel: false
status: pendente
```

```yaml
id: T-06.05
titulo: Homologação e configuração do piloto
objetivo: Validar a história completa e permitir ao gestor configurar setor, participantes, período e suporte do piloto.
arquivos:
  cria: [supabase/migrations/00000000000012_pilot.sql, app/admin/piloto/page.tsx, src/features/administration/pilot-service.ts, docs/pilot-runbook.md, tests/e2e/full-story.spec.ts, tests/e2e/pilot-configuration.spec.ts, tests/security/access-matrix.spec.ts]
  altera: [PROGRESSO.md, docs/testing.md, src/components/navigation.tsx]
teste_integracao: A configuração aceita apenas setor e participantes elegíveis e registra auditoria e critérios de interrupção.
teste_funcional: Gestor configura um piloto com fixtures e os três papéis concluem o roteiro em mobile e desktop.
criterio_aceite: Gates técnicos passam e um piloto de homologação fica persistido com setor, participantes, período e suporte.
depende_de: [T-06.04]
paralelizavel: false
status: pendente
```
