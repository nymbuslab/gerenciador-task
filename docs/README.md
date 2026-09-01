# Documentação do projeto

Este diretório é a fonte técnica do Gestor de Tarefas para Mercado. O `PRD.md` na raiz continua sendo a fonte de requisitos do produto.

## Índice

- [architecture.md](architecture.md) — arquitetura, módulos e fluxo de dados.
- [database.md](database.md) — entidades, relações, integridade e RLS.
- [design-system.md](design-system.md) — aplicação da referência visual no produto.
- [auth-security.md](auth-security.md) — autenticação, autorização e auditoria.
- [tasks-workflows.md](tasks-workflows.md) — ciclo de vida e regras das tarefas.
- [offline-sync.md](offline-sync.md) — cache, fila de mutações e conflitos.
- [notifications.md](notifications.md) — eventos, canais e escaladas.
- [testing.md](testing.md) — estratégia de testes e critérios de aceite.
- [deployment.md](deployment.md) — ambientes, CI/CD, observabilidade e recuperação.
- [gestor-tarefas-mercado/](gestor-tarefas-mercado/) — base, decisões e seis sprints do planejamento SprintX.

## Manutenção

- Uma decisão nova deve ser registrada primeiro no documento do domínio afetado.
- Se mudar comportamento do produto, atualizar também `PRD.md`.
- Se mudar prioridade ou estado, atualizar `PROGRESSO.md` e `ROADMAP.md`.
- Registrar em `CHANGELOG.md` apenas entregas com efeito observável.
