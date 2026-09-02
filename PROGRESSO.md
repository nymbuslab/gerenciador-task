# Progresso do Projeto

> Estado operacional do trabalho. Decisões de produto ficam no `PRD.md`; detalhes técnicos ficam em `docs/`.

## 🔄 Em Andamento

_(nada no momento)_

## 📋 Próximos Passos

- [ ] (P0) Retomar a Sprint 04 pela T-04.01, rota `F-04.1 ∥ F-04.2 -> F-04.3`, depois que a repaginação visual for aprovada. A execução foi pausada de propósito no portão da Sprint 03: as sprints 04 a 06 criam telas novas (escala, indicadores, painel do piloto) e nascer no padrão antigo obrigaria a repaginar duas vezes.
- [ ] (P0) Cadastrar no GitHub Actions os nove secrets consumidos por `.github/workflows/ci.yml` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Sem eles o passo `supabase link` falha e o `ci:verify` quebra no primeiro push ou pull request.
- [ ] (P1) Confirmar a visibilidade do repositório `nymbuslab/gerenciador-task`, hoje público. Nenhum segredo está exposto no histórico atual, mas em repositório público cada commit futuro é publicado na hora e um deslize vira histórico permanente.
- [ ] (P1) Executar as sprints 04 a 06 (recorrência e escala, offline e notificações, indicadores e piloto).
- [ ] (P1) Completar o formulário de criação de tarefa nas telas. O domínio e a função `criar_tarefa` já aceitam público por pessoa e para a loja inteira, conclusão coletiva, prazo, prioridade, checklist, foto e observação; a tela de hoje só oferece título, instruções, setor e exigência de validação.
- [ ] (P1) Preencher `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no `.env.local` quando o Web Push entrar na Sprint 05. Hoje estão vazias, e por isso `readServerEnv` falha se for chamada; o servidor usa a leitura estreita `readSupabaseAdminEnv`.
- [ ] (P1) Decidir o destino de `--cor-texto-apoio` (`#64748d`) no design system. Sobre a superfície suave ela dá 4,49:1 e reprova no mínimo AA de 4,5:1 para texto corrido, então hoje o produto a usa apenas em ícone, onde o mínimo é 3:1. Ou o token sai, ou a regra de uso entra no `docs/design-system.md`.
- [ ] (P1) Levar a repaginação para as telas que ainda não existem quando elas nascerem nas sprints 04 a 06 (escala, indicadores, painel do piloto): a régua de tempo, o navy de estrutura e a pílula única por tela são o padrão agora.
- [ ] (P1) Calcular os marcos de tempo da execução no servidor. Hoje `segundos_ativos` e `segundos_bloqueados` são somados no navegador e enviados na chamada; o banco só recusa valor negativo. Um cliente adulterado infla a própria métrica, o que afeta os indicadores da Sprint 06. A correção é derivar os dois do instante da transição, como o estado já é derivado desde a migration `00000000000009_transicao_segura.sql`.
- [ ] (P1) Preparar piloto operacional com um setor.

## ✅ Concluído

- [x] Premissa e público do produto definidos.
- [x] Entrevista de descoberta concluída.
- [x] Design funcional, técnico e critérios de qualidade aprovados.
- [x] PRD e documentação inicial estruturados.
- [x] Limites de evidência e política de proteção do PIN definidos.
- [x] Plano de seis sprints e 30 tasks gerado com contratos TDD e dependências.
- [x] Documentação inicial revisada e aprovada — 2026-09-01
- [x] Sprint 01 concluída com Supabase remoto, fixtures de teste, CI e `corepack pnpm ci:verify` verde — 2026-09-01
- [x] Repositório Git inicializado e publicado em `nymbuslab/gerenciador-task`, com auditoria de segredos do que foi versionado — 2026-09-01
- [x] Sprint 02 concluída: schema organizacional com matriz RLS, tokens e shell responsivo por papel, assistente de configuração inicial, login por papel, proteção de PIN e administração de equipe e setores — 2026-09-01
- [x] Repaginação visual das sete telas aprovada e implementada, com protótipo em `design/canvas/`, biblioteca de ícones Lucide, régua de tempo no Meu dia, quadro por situação em Setor e Operação, PIN em seis casas e caixa de entrada em `/avisos` — 2026-09-01
- [x] Sprint 03 concluída: schema e RLS de tarefas, máquina de estados com tempo ativo e bloqueado, evidências privadas em WebP, comentários com menção, caixa de entrada interna e as telas Meu dia, Setor e Operação — 2026-09-01
