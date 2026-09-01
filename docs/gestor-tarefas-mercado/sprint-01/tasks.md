# Tasks — Sprint 01

```yaml
id: T-01.01
titulo: Scaffold Next.js e contratos de ambiente
objetivo: Inicializar Git e criar a aplicação Next.js/TypeScript com pnpm, scripts padronizados e validação de ambiente.
arquivos:
  cria: [.git/, package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts, app/layout.tsx, app/page.tsx, src/lib/env.ts, .env.example, .gitignore]
  altera: [CLAUDE.md]
teste_integracao: O build importa a configuração validada sem acessar segredos reais.
teste_funcional: Ao executar a aplicação, GET / retorna 200 com o shell inicial.
criterio_aceite: git status funciona e corepack pnpm build termina com código 0 usando apenas variáveis documentadas em .env.example.
depende_de: []
paralelizavel: false
status: concluida · 2026-09-01 · suíte: lint passed, scaffold passed, home passed, build passed
```

```yaml
id: T-01.02
titulo: Harness unitário e de componentes
objetivo: Configurar Vitest, Testing Library, DOM de teste e cobertura.
arquivos:
  cria: [vitest.config.ts, tests/setup.ts, tests/unit/sentinel.test.ts, tests/components/sentinel.test.tsx]
  altera: []
teste_integracao: O runner carrega aliases TypeScript e o ambiente DOM configurado.
teste_funcional: Os testes sentinela unitário e de componente passam com a saída esperada.
criterio_aceite: corepack pnpm test termina com 0 testes falhando.
depende_de: [T-01.01]
paralelizavel: true
status: concluida · 2026-09-01 · suíte: 2 passed, 0 failed; coleta isolada de E2E
```

```yaml
id: T-01.03
titulo: Harness funcional Playwright
objetivo: Configurar navegador, servidor de teste e projeto mobile/desktop.
arquivos:
  cria: [playwright.config.ts, tests/e2e/sentinel.spec.ts]
  altera: []
teste_integracao: O Playwright inicia a aplicação de teste e encerra o servidor ao finalizar.
teste_funcional: O cenário sentinela abre / em viewport mobile e desktop e encontra o shell.
criterio_aceite: pnpm test:e2e termina com 0 testes falhando nos dois projetos.
depende_de: [T-01.01]
paralelizavel: true
status: concluida · 2026-09-01 · suíte: Playwright 2 passed, 0 failed; cleanup passed
```

```yaml
id: T-01.04
titulo: Supabase remoto e harness de integração
objetivo: Configurar Supabase CLI/SDK e uma suíte que valide migrations e RLS no projeto remoto de desenvolvimento.
arquivos:
  cria: [supabase/config.toml, supabase/migrations/00000000000000_bootstrap.sql, tests/integration/database.test.ts]
  altera: [.env.example]
teste_integracao: A suíte vincula o projeto remoto de desenvolvimento, aplica migrations versionadas e executa uma consulta autenticada.
teste_funcional: O teste sentinela confirma que uma sessão sem permissão não lê uma tabela protegida.
criterio_aceite: corepack pnpm test:integration termina com 0 testes falhando no projeto remoto de desenvolvimento isolado.
depende_de: [T-01.01]
paralelizavel: true
status: concluida - 2026-09-01 - suite: 1 passed, 0 failed; migration 00000000000000 applied remotely
```

```yaml
id: T-01.05
titulo: Fixtures e pipeline de CI
objetivo: Criar fábrica de identidades de teste e executar todos os gates no CI.
arquivos:
  cria: [tests/fixtures/identities.ts, .github/workflows/ci.yml]
  altera: [package.json, docs/testing.md]
teste_integracao: O CI sobe Supabase e carrega fixtures isoladas para gestor, líder e funcionário.
teste_funcional: O comando local de CI executa tipos, lint, testes, integração, E2E e build na mesma ordem do workflow.
criterio_aceite: pnpm ci:verify termina com código 0 localmente e o workflow válido referencia o mesmo comando.
depende_de: [T-01.02, T-01.03, T-01.04]
paralelizavel: false
status: concluida - 2026-09-01 - suite: ci:verify passed; unit/components 3 passed, integration 1 passed, e2e 2 passed, build passed
```
