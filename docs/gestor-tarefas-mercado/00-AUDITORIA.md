# Auditoria — gestor-tarefas-mercado

Data: 2026-09-01 — reauditoria após regeneração da F3/F4

As linhas abaixo preservam o texto original da auditoria. A coluna `situação` é acompanhamento posterior e registra o que aconteceu com cada ressalva.

| severidade | arquivo | problema | correção sugerida | situação |
|---|---|---|---|---|
| MÉDIA | ORQUESTRADOR.md | Comandos exatos ainda não existem porque o scaffold não foi executado. | T-01.01 deve criar os scripts e atualizar a seção Ferramentas antes de avançar na Sprint 01. | Resolvida em 2026-09-01 pela Sprint 01. Os comandos da seção Ferramentas do `ORQUESTRADOR.md` existem como scripts reais no `package.json`. |
| MÉDIA | sprint-06/tasks.md | T-06.04 depende de contas e segredos externos de Vercel/Supabase, embora o pré-requisito esteja declarado. | Verificar o secret manager antes da task; se ausente, registrar bloqueio conforme o orquestrador. | Em aberto. Relacionada ao item P0 do `PROGRESSO.md` que cadastra os nove secrets do `.github/workflows/ci.yml`; verificar de novo antes de iniciar a T-06.04. |

VEREDITO: SIM — o plano está pronto para execução autônoma.
