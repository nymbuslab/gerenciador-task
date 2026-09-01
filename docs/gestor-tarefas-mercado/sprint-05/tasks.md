# Tasks — Sprint 05

```yaml
id: T-05.01
titulo: Manifesto, service worker e cache por identidade
objetivo: Tornar a PWA instalável e armazenar o snapshot diário autorizado em IndexedDB.
arquivos:
  cria: [app/manifest.ts, public/sw.js, src/features/sync/local-store.ts, tests/e2e/pwa-cache.spec.ts]
  altera: [app/layout.tsx]
teste_integracao: Service worker e IndexedDB isolam cache por usuário e limpam dados no logout.
teste_funcional: Após carregar Meu dia e desligar a rede, a PWA reabre as tarefas da mesma identidade.
criterio_aceite: Instalação, cache autorizado e limpeza no logout passam nos testes.
depende_de: [T-04.04]
paralelizavel: true
status: pendente
```

```yaml
id: T-05.02
titulo: Central interna e Realtime
objetivo: Persistir notificações e atualizar clientes conectados em tempo real.
arquivos:
  cria: [supabase/migrations/00000000000008_notifications.sql, src/features/notifications/service.ts, app/notificacoes/page.tsx, tests/integration/notifications.test.ts]
  altera: [src/components/navigation.tsx]
teste_integracao: Cada evento suportado cria uma notificação autorizada e deduplicada para o destinatário.
teste_funcional: Uma nova atribuição aparece na central conectada sem atualizar a página.
criterio_aceite: Criação, leitura, deduplicação e RLS passam na suíte.
depende_de: [T-04.04]
paralelizavel: true
status: pendente
```

```yaml
id: T-05.03
titulo: Web Push e escaladas
objetivo: Registrar assinaturas e enviar lembretes e escaladas nos intervalos aprovados.
arquivos:
  cria: [supabase/migrations/00000000000009_push.sql, src/features/notifications/push-service.ts, tests/integration/push.test.ts]
  altera: [app/notificacoes/page.tsx, .env.example]
teste_integracao: Job atrasado notifica líder imediatamente e gestor após 30 minutos sem duplicar eventos.
teste_funcional: Negar permissão de push mantém a mesma notificação disponível na central interna.
criterio_aceite: Assinatura, lembrete de 15 minutos, escaladas e fallback interno passam.
depende_de: [T-05.02]
paralelizavel: false
status: pendente
```

```yaml
id: T-05.04
titulo: Fila idempotente de comandos offline
objetivo: Persistir comandos locais ordenados e aplicar cada command_id uma única vez.
arquivos:
  cria: [supabase/migrations/00000000000010_sync.sql, src/features/sync/outbox.ts, src/features/sync/sync-service.ts, tests/integration/sync-idempotency.test.ts]
  altera: [src/features/sync/local-store.ts]
teste_integracao: Repetir o mesmo command_id retorna o resultado anterior sem duplicar transição ou auditoria.
teste_funcional: Iniciar e concluir offline sincroniza na ordem correta após reconexão.
criterio_aceite: Ordem, persistência após reload e idempotência passam na suíte.
depende_de: [T-05.01]
paralelizavel: false
status: pendente
```

```yaml
id: T-05.05
titulo: Evidências offline e conflitos
objetivo: Sincronizar arquivos antes da conclusão e apresentar conflito sem sobrescrita silenciosa.
arquivos:
  cria: [src/features/sync/conflict-resolution.ts, src/components/sync-status.tsx, tests/e2e/offline-conflict.spec.ts]
  altera: [src/features/sync/sync-service.ts, src/features/execution/image-compression.ts, src/components/app-shell.tsx]
teste_integracao: Versão divergente recusa o comando e devolve snapshot atual sem alterar o registro.
teste_funcional: Foto e conclusão offline sincronizam após reconexão e conflito exibe ação de atualização.
criterio_aceite: Upload ordenado, retry, conflito e feedback de sincronização passam.
depende_de: [T-05.03, T-05.04]
paralelizavel: false
status: pendente
```
