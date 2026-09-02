# Gestor de Tarefas para Mercado

PWA para distribuir, executar e acompanhar tarefas operacionais de uma loja de mercado.

> Este arquivo contém apenas regras específicas do projeto. O produto e seus limites estão definidos em `PRD.md`.

## Stack

- **Linguagem:** TypeScript
- **Aplicação:** Next.js com App Router
- **Interface:** React e design system próprio derivado de `assets/DESIGN-stripe.md`
- **Backend:** recursos server-side do Next.js e projeto Supabase remoto via CLI/SDK
- **Banco:** PostgreSQL remoto no Supabase com migrations versionadas e Row Level Security
- **Autenticação e arquivos:** Supabase Auth e Storage privado
- **Atualizações:** Supabase Realtime
- **Hospedagem:** Vercel e Supabase
- **Testes planejados:** Vitest, Testing Library e Playwright

## Regras de desenvolvimento

1. Usar TypeScript estrito; não introduzir `any` sem justificativa documentada.
2. Implementar regras de domínio fora de componentes visuais e handlers de transporte.
3. Toda mudança de banco deve usar migration versionada e política RLS testada.
4. Nunca confiar apenas na ocultação da interface para aplicar permissões.
5. Toda mutação offline deve ser idempotente e possuir controle explícito de versão.
6. Toda task de implementação começa pelo teste correspondente.
7. Não armazenar valores reais de ambiente ou credenciais no repositório.
8. Usar caminhos relativos na documentação e manter `docs/README.md` atualizado.
9. Nenhuma tela, componente ou botão entra sem protótipo aprovado em `design/canvas/` e sem captura conferida em desktop e celular.

## Organização planejada

```text
app/                 rotas, layouts e composição da aplicação
src/components/      componentes visuais reutilizáveis
src/features/        módulos de negócio por capacidade
src/lib/             infraestrutura compartilhada
supabase/migrations/ schema, funções, triggers e políticas RLS
tests/               fixtures e testes funcionais/integrados
docs/                documentação viva do projeto
```

## Variáveis de ambiente planejadas

- `NEXT_PUBLIC_SUPABASE_URL` — URL pública do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chave pública sujeita a RLS.
- `SUPABASE_SERVICE_ROLE_KEY` — chave apenas de servidor para operações administrativas controladas.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — chave pública de Web Push.
- `VAPID_PRIVATE_KEY` — chave privada de Web Push, somente no servidor.
- `VAPID_SUBJECT` — identificação de contato do emissor de notificações.
- `SUPABASE_ACCESS_TOKEN` — token pessoal usado somente pela CLI em ambiente local/CI seguro.
- `SUPABASE_PROJECT_REF` — referência do projeto remoto de desenvolvimento.
- `SUPABASE_DB_PASSWORD` — senha do banco remoto usada pela CLI; nunca exposta ao cliente.

## Comandos

```bash
corepack pnpm dev
corepack pnpm build
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:coverage
corepack pnpm test:e2e
```

O gate completo da fundação é `corepack pnpm ci:verify`.

## Fontes do projeto

- Produto: `PRD.md`
- Progresso: `PROGRESSO.md`
- Direção: `ROADMAP.md`
- Histórico: `CHANGELOG.md`
- Índice técnico: `docs/README.md`
- Referência visual original: `assets/DESIGN-stripe.md`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
