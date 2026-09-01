# Sprint 02 — Identidade, organização e shell

## Objetivo

Entregar onboarding, autenticação, gestão administrativa, autorização por loja/setor e navegação responsiva por papel.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Organização e RLS | F-02.2 |
| F-02.2 | Design system e shell | F-02.1 |
| F-02.3 | Autenticação e acesso | nenhuma |

## Critério de saída

O primeiro gestor configura a loja, administra equipe/setores e os três papéis veem somente navegação e dados autorizados.

## Riscos conhecidos

- PIN exige proteção adicional contra força bruta (`docs/auth-security.md`).
- Cache deve ser separado por identidade em aparelhos compartilhados (`docs/offline-sync.md`).
