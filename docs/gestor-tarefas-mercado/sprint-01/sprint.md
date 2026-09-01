# Sprint 01 — Fundação e capacidade de teste

## Objetivo

Criar o projeto executável, as conexões locais e todos os harnesses necessários para desenvolver as próximas sprints com TDD, sem implementar funcionalidade de negócio.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Scaffold | nenhuma |
| F-01.2 | Harnesses de teste | F-01.3 |
| F-01.3 | Banco remoto e CI | F-01.2 |

Detalhes em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`pnpm ci:verify` termina com código 0 localmente e o workflow referencia esse mesmo comando sem erro de sintaxe.

## Riscos conhecidos

- Versões exatas só serão fixadas pelo lockfile criado no scaffold (`base/00-LACUNAS.md`).
- O ambiente de integração depende de um projeto Supabase remoto de desenvolvimento e credenciais CLI (`docs/testing.md`).
