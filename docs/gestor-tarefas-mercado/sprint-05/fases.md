# Fases — Sprint 05

## F-05.1 — PWA e cache
**Objetivo:** Instalar a aplicação e manter snapshot autorizado do dia por identidade.
**Tasks que a compõem:** T-05.01
**Critério de saída:** PWA instala e reabre o Meu dia sem rede usando dados da sessão atual.
**Roda em paralelo com:** F-05.2

## F-05.2 — Notificações
**Objetivo:** Persistir central interna, Realtime e Web Push com deduplicação.
**Tasks que a compõem:** T-05.02, T-05.03
**Critério de saída:** eventos geram uma notificação interna e no máximo um push por destinatário/dispositivo.
**Roda em paralelo com:** F-05.1

## F-05.3 — Sincronização transacional
**Objetivo:** Enfileirar comandos e evidências, sincronizar e tratar conflitos.
**Tasks que a compõem:** T-05.04, T-05.05
**Critério de saída:** cenários de repetição, reconexão e conflito passam sem perda ou duplicação.
**Roda em paralelo com:** nenhuma

