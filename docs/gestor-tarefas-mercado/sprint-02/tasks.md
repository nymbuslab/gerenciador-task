# Tasks — Sprint 02

```yaml
id: T-02.01
titulo: Schema organizacional e matriz RLS
objetivo: Persistir loja, setores, perfis e memberships com políticas por papel e setor.
arquivos:
  cria: [supabase/migrations/00000000000001_organization.sql, tests/integration/organization-rls.test.ts]
  altera: [tests/fixtures/identities.ts]
teste_integracao: A matriz RLS valida leituras e escritas permitidas e negadas para os três papéis.
teste_funcional: Um líder consulta o próprio setor e recebe negação ao consultar outro setor.
criterio_aceite: Todos os casos da matriz de autorização passam contra o Supabase remoto de desenvolvimento.
depende_de: [T-01.05]
paralelizavel: true
status: concluida - 2026-09-01 - suite: integracao 16 passed, 0 failed; unit/components 5 passed; typecheck e lint sem erro
```

```yaml
id: T-02.02
titulo: Tokens e shell responsivo
objetivo: Transformar a referência Stripe em tokens e navegação adaptada aos papéis.
arquivos:
  cria: [src/styles/tokens.css, src/components/app-shell.tsx, src/components/navigation.tsx, tests/components/app-shell.test.tsx]
  altera: [app/layout.tsx, app/page.tsx]
teste_integracao: O shell recebe papel e rota autorizada sem importar infraestrutura de banco.
teste_funcional: Em mobile e desktop cada papel vê somente seus destinos de navegação.
criterio_aceite: Os testes de componente e E2E do shell passam para os três papéis.
depende_de: [T-01.05]
paralelizavel: true
status: concluida - 2026-09-01 - suite: ci:verify passed; unit/components 16 passed, integracao 16 passed, e2e 12 passed (desktop e mobile), build passed
```

```yaml
id: T-02.03
titulo: Sessão e login por papel
objetivo: Integrar Supabase Auth para senha forte e usuário com PIN.
arquivos:
  cria: [src/features/identity/auth-service.ts, app/login/page.tsx, app/auth/callback/route.ts, tests/integration/auth.test.ts]
  altera: [.env.example, src/components/app-shell.tsx]
teste_integracao: Sessões criadas para funcionário, líder e gestor carregam o membership correto.
teste_funcional: Credenciais válidas direcionam cada papel à sua página inicial e inválidas exibem erro neutro.
criterio_aceite: Os três logins válidos e um login inválido passam nos testes funcionais.
depende_de: [T-02.01, T-02.02, T-02.05]
paralelizavel: false
status: concluida - 2026-09-01 - suite: ci:verify passed; integracao 31 passed (3 logins validos por papel e recusa neutra), unit/components 16 passed, e2e 18 passed e 2 skipped
```

```yaml
id: T-02.05
titulo: Onboarding da primeira loja e gestor
objetivo: Criar a loja e a primeira conta gestora uma única vez por assistente protegido.
arquivos:
  cria: [app/configuracao-inicial/page.tsx, app/api/bootstrap/route.ts, src/features/administration/bootstrap-service.ts, tests/integration/bootstrap.test.ts, tests/e2e/bootstrap.spec.ts]
  altera: []
teste_integracao: Duas solicitações concorrentes criam exatamente uma loja e um gestor e a posterior é recusada.
teste_funcional: O assistente cria o primeiro gestor, autentica e fica indisponível ao ser aberto novamente.
criterio_aceite: Criação atômica, auditoria, concorrência e desativação permanente passam na suíte.
depende_de: [T-02.01, T-02.02]
paralelizavel: false
status: concluida - 2026-09-01 - suite: ci:verify passed; unit/components 16 passed, integracao 22 passed, e2e 14 passed e 2 skipped (assistente roda uma vez por execucao)
```

```yaml
id: T-02.06
titulo: Gestão administrativa de equipe e setores
objetivo: Permitir ao gestor administrar funcionários, setores, líderes, vínculos e acessos.
arquivos:
  cria: [app/admin/funcionarios/page.tsx, app/admin/setores/page.tsx, src/features/administration/team-service.ts, tests/integration/admin-team.test.ts, tests/e2e/admin-team.spec.ts]
  altera: [src/components/navigation.tsx, src/features/identity/pin-service.ts]
teste_integracao: CRUD, arquivamento, transferência, redefinição e desbloqueio respeitam integridade e RLS.
teste_funcional: Gestor cria setor, cadastra funcionário, promove líder, transfere vínculo e redefine o PIN.
criterio_aceite: Todos os fluxos administrativos passam e usuários arquivados não autenticam.
depende_de: [T-02.04, T-02.05]
paralelizavel: false
status: concluida - 2026-09-01 - suite: ci:verify passed; integracao 44 passed, unit/components 16 passed, e2e 21 passed e 5 skipped
```

```yaml
id: T-02.04
titulo: Proteção e redefinição de PIN
objetivo: Aplicar cinco tentativas, bloqueio de 15 minutos, auditoria e desbloqueio pelo gestor.
arquivos:
  cria: [supabase/migrations/00000000000002_pin_security.sql, src/features/identity/pin-service.ts, tests/integration/pin-security.test.ts, tests/e2e/pin-lockout.spec.ts]
  altera: [app/login/page.tsx]
teste_integracao: A sexta tentativa durante o bloqueio é recusada e o desbloqueio do gestor restaura o acesso.
teste_funcional: Cinco PINs inválidos exibem bloqueio sem revelar se o usuário existe.
criterio_aceite: Bloqueio, expiração, auditoria e desbloqueio passam na suíte.
depende_de: [T-02.03]
paralelizavel: false
status: concluida - 2026-09-01 - suite: ci:verify passed; integracao 39 passed (bloqueio, expiracao, auditoria e desbloqueio), unit/components 16 passed, e2e 19 passed e 4 skipped
```
