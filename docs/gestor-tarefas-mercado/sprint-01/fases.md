# Fases — Sprint 01

## F-01.1 — Scaffold

**Objetivo:** Criar a aplicação, configuração TypeScript e contratos de ambiente.

**Tasks que a compõem:** T-01.01

**Critério de saída:** `pnpm build` termina com código 0 e nenhuma variável secreta está versionada.

**Roda em paralelo com:** nenhuma

## F-01.2 — Harnesses de teste

**Objetivo:** Disponibilizar testes unitários, de componentes e funcionais reproduzíveis.

**Tasks que a compõem:** T-01.02, T-01.03

**Critério de saída:** as suítes unitária e funcional executam testes sentinela com código 0.

**Roda em paralelo com:** F-01.3

## F-01.3 — Banco remoto e CI

**Objetivo:** Disponibilizar Supabase remoto de desenvolvimento, harness de integração, fixtures e gates automatizados.

**Tasks que a compõem:** T-01.04, T-01.05

**Critério de saída:** `pnpm ci:verify` conecta ao projeto isolado, aplica migrations base, carrega fixtures e termina com código 0; o workflow chama o mesmo comando.

**Roda em paralelo com:** F-01.2
