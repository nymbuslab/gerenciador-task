# Produto e domínio

## Contrato de entrada

Comandos autenticados de administração, criação, atribuição, início, bloqueio, retomada, conclusão, validação, comentários, escala e relatórios. Campos e regras estão em `PRD.md` e `docs/tasks-workflows.md`.

## Contrato de saída

Tarefas autorizadas por papel, histórico, escala, notificações, indicadores operacionais e CSV filtrado. Formato HTTP final: NÃO DOCUMENTADO.

## Limites e cotas

- Operação inicial de até 30 funcionários (`PRD.md`, seção 1).
- Piloto de 14 dias (`PRD.md`, seção 10).
- Retenção de evidências e histórico pessoal por 12 meses (`PRD.md`, seção 7).
- Demais cotas: NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

- Evidência obrigatória ausente impede conclusão.
- Bloqueio ou reprovação sem justificativa é rejeitado.
- Responsável não escalado envia a ocorrência à fila do setor.
- Conflito de versão offline exige atualização explícita.

## Riscos para a nossa implementação

Estados, recorrências e modos de conclusão coletiva podem divergir se não forem centralizados no domínio. Métricas ficam incorretas se duração ativa, tempo bloqueado e cancelamentos forem misturados.

## Fonte

`PRD.md`; `docs/tasks-workflows.md`; `docs/testing.md` — acessados em 2026-09-01.

