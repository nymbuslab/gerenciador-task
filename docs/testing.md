# Estratégia de testes

## Pirâmide

- **Unitários:** regras de estado, recorrência, elegibilidade, tempo e métricas.
- **Integração:** projeto Supabase remoto de desenvolvimento isolado para migrations, constraints, RLS, Storage, jobs, idempotência e consultas.
- **Componentes:** formulário, checklist, estados de sincronização, filtros e acessibilidade.
- **Funcionais:** jornadas completas em mobile e desktop com Playwright.

## Cenários críticos

1. Funcionário não acessa tarefa individual de outra pessoa.
2. Líder não consulta nem altera outro setor.
3. Tarefa coletiva encerra conforme o modo configurado.
4. Requisitos ausentes impedem conclusão.
5. Reprovação devolve para execução e preserva histórico.
6. Tempo bloqueado não entra na duração ativa.
7. Recorrência não duplica ocorrência ao repetir job.
8. Ausência na escala envia tarefa à fila correta.
9. Repetição de comando offline não duplica ação.
10. Conflito offline não sobrescreve versão nova.
11. Evidência privada não abre sem autorização.
12. Falha de push mantém aviso interno.
13. CSV respeita filtros, permissões e métricas exibidas.

## Critério por task

Uma task só conclui quando seu teste de integração e seu teste funcional passam. Critérios devem ser binários e reproduzíveis.

## Gate de CI

O comando local de referencia e `corepack pnpm ci:verify`. Ele executa typecheck, lint, testes unitarios/de componentes, aplica migrations remotas com `supabase db push`, roda integracao, build, instala o Chromium do Playwright quando necessario e executa E2E.

O workflow `.github/workflows/ci.yml` chama o mesmo comando depois de instalar dependencias e vincular a Supabase CLI ao projeto remoto de desenvolvimento.

Secrets esperados no CI:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

As fixtures em `tests/fixtures/identities.ts` usam IDs e emails deterministicos de teste. Elas nao armazenam senhas, PINs nem chaves reais.

## Piloto

A entrega técnica termina com o ambiente pronto e o piloto configurável pelo gestor. Depois, o gestor executa o piloto por 14 dias em um setor; a expansão exige ausência de perda de dados, violação de permissão e falha crítica, além do aceite registrado.
