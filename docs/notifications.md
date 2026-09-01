# Notificações

## Canais

- **Central interna:** fonte persistente e confiável.
- **Web Push:** entrega complementar por dispositivo com consentimento explícito.

Ausência de suporte ou falha no push nunca elimina a notificação interna.

## Eventos

- Nova atribuição ou reatribuição.
- Lembrete de prazo.
- Tarefa atrasada.
- Bloqueio e resolução de bloqueio.
- Menção em comentário.
- Solicitação, aprovação ou reprovação.
- Tarefa recorrente sem responsável devido à escala.

## Escalada padrão

- Executor: 15 minutos antes do prazo.
- Líder: imediatamente ao atraso ou bloqueio no setor.
- Gestor: 30 minutos após atraso/bloqueio ainda não resolvido.

O gestor pode ajustar intervalos. Eventos possuem chave de deduplicação para evitar alertas repetidos por reexecução de job.

## Preferências

Notificações críticas de atribuição, bloqueio e atraso permanecem na central. Preferências podem silenciar push por categoria, dispositivo ou período, sem apagar o registro interno.

