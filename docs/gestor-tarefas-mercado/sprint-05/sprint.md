# Sprint 05 — PWA, offline e notificações

## Objetivo

Tornar a operação instalável e resiliente à perda de conexão, com central interna, Realtime e Web Push.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-05.1 | PWA e cache | F-05.2 |
| F-05.2 | Notificações | F-05.1 |
| F-05.3 | Sincronização transacional | nenhuma |

## Critério de saída

O fluxo diário funciona offline, sincroniza sem duplicação e mantém notificações internas mesmo quando o push falha.

## Riscos conhecidos

- Conflitos não podem sobrescrever a versão do servidor (`docs/offline-sync.md`).
- Push depende do suporte e consentimento do navegador (`docs/notifications.md`).

