# Changelog

Todas as mudanças observáveis do projeto serão documentadas neste arquivo.

## [Não lançado]

### Adicionado

- PRD inicial do Gestor de Tarefas para Mercado.
- Contexto técnico e regras específicas do projeto.
- Roadmap, progresso e estrutura de documentação por domínio.
- Planejamento do MVP aprovado para uma loja e até 30 funcionários.
- Scaffold Next.js 16/React 19 com TypeScript estrito, pnpm/Corepack e shell inicial responsivo.
- Harness Supabase remoto, fixtures de identidades de teste, workflow de CI e gate `ci:verify`.
- Schema de loja, setores, perfis e vínculos com Row Level Security por papel e por setor.
- Tokens visuais derivados da referência Stripe e shell responsivo com navegação por papel.
- Assistente de configuração inicial que cria a loja e o primeiro gestor uma única vez.
- Entrada por e-mail e senha para liderança e por usuário e PIN para funcionário.
- Bloqueio do PIN por 15 minutos após cinco tentativas inválidas, com auditoria e desbloqueio pelo gestor.
- Administração de equipe e setores pelo gestor, com cadastro, promoção, transferência, redefinição de PIN e arquivamento.
- Tarefas com público por pessoa, setor ou loja inteira, conclusão coletiva ou individual e destinatários congelados na criação.
- Ciclo de execução com início, bloqueio justificado, retomada, conclusão e validação, separando tempo ativo de tempo bloqueado.
- Evidências em bucket privado, convertidas para WebP no aparelho e entregues apenas por link assinado.
- Requisitos de conclusão por checklist, foto e observação, conferidos antes de a tarefa ser dada como pronta.
- Comentários com menção dentro da tarefa e caixa de entrada interna com aviso de aprovação e de devolução.
- Telas Meu dia, Setor e Operação, com ações por papel em celular e desktop.
- Repaginação das telas sobre a referência visual: estrutura em azul-marinho, uma ação preenchida por tela, régua de tempo no dia do funcionário e quadro por situação para a liderança.
- Caixa de entrada em `/avisos`, com atribuição, menção e decisão de validação.
- Entrada por PIN em seis casas, com colagem do código e aviso do bloqueio antes de ele acontecer.
- Motivo de bloqueio e de reprovação em diálogo próprio, com foco preso e tecla Esc.

### Documentação

- Documentação inicial de produto, arquitetura, segurança, banco, design, testes e execução revisada e aprovada — 2026-09-01.
