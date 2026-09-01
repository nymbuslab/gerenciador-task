# Banco de dados

## Convenções

- PostgreSQL no Supabase, UUID como chave primária e timestamps em UTC.
- Toda tabela operacional contém `created_at`; registros mutáveis contêm `updated_at` e `version`.
- Exclusão funcional usa arquivamento; histórico de auditoria é somente de inserção.
- Todas as tabelas expostas têm RLS habilitada e testes de política.

## Entidades principais

| Entidade | Responsabilidade |
|---|---|
| `stores` | Loja atendida; mantém a evolução para filiais sem singleton global. |
| `sectors` | Setores pertencentes à loja. |
| `profiles` | Dados operacionais ligados à identidade autenticada. |
| `memberships` | Papel e vínculo de uma pessoa com loja e setor. |
| `shifts` | Turno planejado, folga ou substituição. |
| `task_templates` | Regra reutilizável e configuração da recorrência. |
| `task_occurrences` | Instância datada de tarefa avulsa ou recorrente. |
| `task_recipients` | Público resolvido da ocorrência. |
| `task_executions` | Execução coletiva ou individual, responsável e estado. |
| `checklist_items` | Itens e resultado associados a uma execução. |
| `evidence` | Metadados do arquivo privado ou observação exigida. |
| `comments` | Conversa vinculada à tarefa. |
| `mentions` | Destinatários mencionados em comentário. |
| `audit_events` | Linha do tempo imutável de ações relevantes. |
| `notifications` | Caixa de entrada confiável do usuário. |
| `push_subscriptions` | Assinaturas Web Push por usuário e dispositivo. |
| `sync_commands` | Chaves idempotentes e resultado das mutações offline. |
| `pilot_configs` | Setor, participantes, período, suporte e critérios da validação operacional. |

## Invariantes

- Uma execução pertence a exatamente uma ocorrência.
- Confirmação individual cria uma execução por destinatário elegível; conclusão coletiva cria uma execução compartilhada.
- Somente execução em andamento pode concluir ou bloquear.
- Bloqueio exige motivo; reprovação exige justificativa.
- Evidência obrigatória deve existir antes da solicitação de conclusão.
- Mudanças do modelo não alteram ocorrências já geradas.
- Responsável deve estar elegível no setor e, quando aplicável, na escala da ocorrência.

## RLS

- Funcionário lê tarefas próprias e coletivas para as quais seja destinatário.
- Líder lê e altera somente registros do setor ao qual lidera.
- Gestor acessa registros da loja.
- Acesso a evidências exige acesso à execução associada.
- Service Role permanece restrita a jobs e operações administrativas server-side.

## Índices mínimos

- Ocorrências por loja, setor, data e prazo.
- Execuções por responsável, estado e prazo da ocorrência.
- Escalas por usuário e intervalo.
- Notificações por destinatário, leitura e data.
- Eventos por ocorrência e data.
- Comandos de sincronização por usuário e chave idempotente única.
