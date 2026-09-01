# Arquitetura

## Direção

Monólito modular em Next.js/TypeScript, com frontend e operações server-side no mesmo projeto. Supabase fornece PostgreSQL, Auth, Storage e Realtime; Vercel hospeda a aplicação.

## Módulos

- **identity:** autenticação, sessão e recuperação de acesso.
- **organization:** loja, setores, perfis, papéis e vínculos.
- **administration:** onboarding inicial e gestão de funcionários, setores, líderes e acessos.
- **scheduling:** turnos, folgas e substituições.
- **tasks:** modelos, ocorrências, atribuições e checklist.
- **execution:** estados, cronômetro, bloqueios e validações.
- **collaboration:** comentários, menções e evidências.
- **notifications:** central interna, assinaturas push e escaladas.
- **reporting:** indicadores, filtros e CSV.
- **sync:** cache local, fila idempotente e resolução de conflitos.

Cada módulo expõe casos de uso tipados; componentes e rotas não acessam tabelas diretamente fora da camada de dados do módulo.

## Fluxo de escrita

1. Cliente envia comando autenticado com identificador idempotente.
2. Camada server-side valida payload e permissão contextual.
3. Banco reaplica autorização por RLS e executa a transação.
4. Evento de auditoria e notificação é persistido na mesma operação lógica.
5. Realtime atualiza clientes conectados; clientes offline conciliam na próxima sincronização.

## Processos assíncronos

Jobs agendados geram ocorrências recorrentes, detectam atrasos, escalam notificações e aplicam retenção. Cada job deve ser idempotente, registrar execução e poder ser repetido com segurança.

## Princípios

- PostgreSQL é a fonte de verdade; push e Realtime são mecanismos de entrega.
- Autorização existe no servidor e na RLS, nunca somente na interface.
- Status atrasado é derivado de prazo e conclusão, não armazenado como estado concorrente.
- Datas são armazenadas em UTC e exibidas em `America/Sao_Paulo`.
