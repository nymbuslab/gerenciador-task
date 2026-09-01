# Tarefas e fluxos

## Criação

Uma tarefa define público, setor, responsável opcional, instruções, prioridade, duração estimada, janela ou prazo e requisitos de conclusão. Pode ser avulsa ou originada de modelo recorrente.

## Público e conclusão

- **Pessoa:** uma execução atribuída ao usuário.
- **Setor ou todos, coletiva:** uma execução compartilhada; a primeira conclusão válida encerra para o grupo.
- **Setor ou todos, individual:** uma execução por destinatário elegível.

Os destinatários são materializados na ocorrência para preservar o histórico mesmo se equipe ou escala mudar depois.

## Estados

```text
pendente -> em execução -> concluída
                    \-> aguardando validação -> concluída
     em execução -> bloqueada -> em execução
pendente/em execução/bloqueada/aguardando validação -> cancelada
aguardando validação -> em execução (reprovação justificada)
```

“Atrasada” é condição calculada. Iniciar registra o primeiro início; retomar acumula nova faixa ativa. Bloquear encerra a faixa ativa corrente e inicia a contagem bloqueada.

## Recorrência

- Frequência diária, semanal ou dias específicos.
- Geração idempotente: um modelo não cria duas ocorrências para a mesma referência.
- Editar série afeta somente ocorrências futuras ainda não geradas.
- Editar ocorrência não altera o modelo.
- Responsável ausente na escala produz tarefa sem responsável na fila do setor.

## Evidências e validação

- Checklist obrigatório exige todos os itens obrigatórios marcados.
- Foto e observação seguem configuração da tarefa.
- Aprovação opcional envia a execução a líder do setor ou gestor autorizado.
- Reprovação exige justificativa e notifica o executor.

## Arquivamento

Modelos, usuários e setores com histórico não são apagados fisicamente pela interface. Cancelamentos e arquivamentos preservam auditoria e são excluídos das métricas operacionais quando definido no PRD.

