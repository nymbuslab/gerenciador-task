# Auditoria — gestor-tarefas-mercado

Data: 2026-09-01 — reauditoria após regeneração da F3/F4

| severidade | arquivo | problema | correção sugerida |
|---|---|---|---|
| MÉDIA | ORQUESTRADOR.md | Comandos exatos ainda não existem porque o scaffold não foi executado. | T-01.01 deve criar os scripts e atualizar a seção Ferramentas antes de avançar na Sprint 01. |
| MÉDIA | sprint-06/tasks.md | T-06.04 depende de contas e segredos externos de Vercel/Supabase, embora o pré-requisito esteja declarado. | Verificar o secret manager antes da task; se ausente, registrar bloqueio conforme o orquestrador. |

VEREDITO: SIM — o plano está pronto para execução autônoma.
