# Experiência e design

## Contrato de entrada

Papel do usuário, tarefas autorizadas, estado de conectividade, progresso diário, escala e indicadores.

## Contrato de saída

Interface Meu dia para funcionário, Setor para líder e Operação para gestor, com equivalência funcional entre mobile e desktop.

## Limites e cotas

- Alvo de toque mínimo de 44 × 44 px (`docs/design-system.md`, seção Acessibilidade).
- Contraste conforme WCAG AA (`docs/design-system.md`, seção Acessibilidade).
- Outros limites visuais constam em `assets/DESIGN-stripe.md`.

## Erros conhecidos e tratamento

Estados vazios, carregamento, offline, sincronização, conflito, permissão e erro recuperável devem possuir representação explícita.

## Riscos para a nossa implementação

Usar colunas no celular compromete legibilidade; a visão Operação deve virar abas/listas. Cor não pode ser o único indicador de prioridade ou estado.

## Fonte

`assets/DESIGN-stripe.md`; `docs/design-system.md`; `PRD.md` — acessados em 2026-09-01.

