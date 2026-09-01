# Design system

## Fonte visual

`assets/DESIGN-stripe.md` é a referência visual original. Este documento define como ela será aplicada ao produto; não substitui seus tokens detalhados.

## Direção

- Azul-marinho profundo para estrutura e navegação.
- Índigo elétrico para ações primárias e progresso.
- Superfícies brancas ou quase brancas, bordas discretas e profundidade leve.
- Tipografia editorial leve em títulos e números tabulares em prazos e métricas.
- Gradientes atmosféricos reservados a cabeçalhos e estados de destaque.

## Experiência por dispositivo

- **Funcionário/mobile:** agenda e checklist; próxima ação sempre visível.
- **Líder:** visão por setor, filtros e filas operacionais.
- **Gestor/desktop:** visão por status em colunas; no celular, abas/listas equivalentes.
- Kanban não será a interação principal do funcionário e arrastar não será requisito para operar no celular.

## Componentes fundamentais

- Shell responsivo, navegação por papel e cabeçalho contextual.
- Cartão de tarefa, chip de prioridade/status e indicador de prazo.
- Checklist, upload de evidência, cronômetro e bloqueio com motivo.
- Filtros, tabela responsiva, painel de métricas e exportação.
- Feedback de conexão, fila offline, conflito e sincronização.
- Estados vazios, skeletons, erros recuperáveis e confirmação de ações críticas.

## Acessibilidade

- Alvos de toque com no mínimo 44 × 44 px.
- Contraste conforme WCAG AA e informação nunca expressa apenas por cor.
- Foco visível, navegação por teclado e nomes acessíveis.
- Respeitar redução de movimento e zoom de texto.
- Estados e erros anunciados por tecnologias assistivas.

## Governança

- Tokens são a fonte única de cores, espaçamento, raio, sombra e tipografia.
- Componentes novos precisam cobrir estados padrão, hover, foco, desabilitado, carregando e erro.
- Mudanças visuais relevantes devem ser verificadas em viewport mobile e desktop.

