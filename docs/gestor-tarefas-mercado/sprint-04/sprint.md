# Sprint 04 — Recorrência e escala

## Objetivo

Automatizar rotinas e planejar turnos, folgas e substituições sem implementar controle de ponto.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-04.1 | Escala | F-04.2 |
| F-04.2 | Recorrência | F-04.1 |
| F-04.3 | Integração operacional | nenhuma |

## Critério de saída

Jobs geram uma única ocorrência por referência e enviam tarefas de responsáveis ausentes à fila correta do setor.

## Riscos conhecidos

- Alteração de série não pode reescrever ocorrências existentes (`docs/tasks-workflows.md`).
- Datas devem respeitar UTC e exibição em São Paulo (`docs/architecture.md`).

