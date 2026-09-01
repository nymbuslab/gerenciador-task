# Fases — Sprint 06

## F-06.1 — Relatórios
**Objetivo:** Calcular indicadores operacionais e exportar o mesmo recorte em CSV.
**Tasks que a compõem:** T-06.01
**Critério de saída:** painel e CSV retornam os mesmos totais para todas as fixtures de referência.
**Roda em paralelo com:** F-06.2

## F-06.2 — Operação e retenção
**Objetivo:** Implantar observabilidade, recuperação local testada e retenção de 12 meses.
**Tasks que a compõem:** T-06.02, T-06.03
**Critério de saída:** jobs, alertas, remoção e restauração passam no ambiente local controlado.
**Roda em paralelo com:** F-06.1

## F-06.3 — Homologação e piloto
**Objetivo:** Publicar os ambientes, validar a história completa e permitir configurar o piloto pelo painel.
**Tasks que a compõem:** T-06.04, T-06.05
**Critério de saída:** deploy, smoke, homologação e configuração simulada do piloto estão aprovados.
**Roda em paralelo com:** nenhuma
