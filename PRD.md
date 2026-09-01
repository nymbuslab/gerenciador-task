# PRD — Gestor de Tarefas para Mercado

## 1. Visão do produto

PWA mobile-first para organizar a rotina diária de uma única loja de mercado. Gestores e líderes distribuem tarefas; funcionários consultam o que precisam fazer, registram a execução e devolvem evidências. O produto acompanha prazos, duração, impedimentos e gargalos operacionais.

O modelo inicial atende até 30 funcionários e deve permitir evolução futura para múltiplas filiais sem depender de uma loja global fixa.

## 2. Problema

A distribuição e o acompanhamento de tarefas diárias dependem de comunicação informal, dificultando saber quem é responsável, o que está atrasado, quais trabalhos foram comprovados e onde a operação está bloqueada.

## 3. Objetivos

- Dar a cada funcionário uma lista diária clara e priorizada.
- Permitir que líderes controlem somente o próprio setor.
- Dar ao gestor visão integral da operação e de seus gargalos.
- Registrar duração ativa, bloqueios, evidências e validações.
- Continuar operando durante oscilações de conectividade.
- Automatizar rotinas recorrentes e considerar a escala diária.

## 4. Papéis e permissões

### Funcionário

- Consulta tarefas pessoais, do setor e gerais para as quais seja elegível.
- Inicia, bloqueia, retoma e conclui suas execuções.
- Preenche checklist, observação e foto quando exigidos.
- Comenta e menciona participantes autorizados.

### Líder de setor

- Possui todas as capacidades do funcionário.
- Cria, atribui, reatribui, valida e cancela tarefas somente no próprio setor.
- Gerencia a escala do próprio setor e resolve sua fila sem responsável.
- Não consulta nem altera dados operacionais de outros setores.

### Gestor

- Possui visão e controle sobre toda a loja.
- Administra usuários, setores, escalas, modelos recorrentes e configurações.
- Consulta indicadores e exporta relatórios em CSV.
- Cadastra, edita e arquiva funcionários e setores.
- Define líderes, vínculos de setor e credenciais de acesso.
- Desbloqueia PIN e redefine acessos.
- Configura o setor, participantes e período do piloto pelo painel.

### Configuração inicial

- Enquanto não existir gestor, um assistente protegido cria a loja e a primeira conta gestora.
- Após a conclusão, o assistente fica permanentemente desativado.
- Contas seguintes são criadas somente por gestor autenticado.

## 5. Experiência principal

- **Meu dia:** agenda/checklist mobile ordenada por atraso, prioridade e janela de execução.
- **Setor:** escala, progresso coletivo, tarefas sem responsável, bloqueios e validações.
- **Operação:** visão por setor e status; colunas no desktop e abas/listas no celular.
- **Notificações:** central interna e Web Push para atribuições, prazos, atrasos, bloqueios, menções e validações.

## 6. Requisitos funcionais

### Tarefas

- Atribuição a pessoa, setor ou toda a loja.
- Tarefas coletivas com uma conclusão para o grupo ou confirmação por destinatário.
- Prioridade, instruções, duração estimada, janela de execução ou prazo exato.
- Requisitos configuráveis: checklist, foto, observação e aprovação.
- Estados: pendente, em execução, bloqueada, aguardando validação, concluída e cancelada.
- Bloqueio exige motivo; reprovação exige justificativa e devolve a execução ao trabalho.
- Histórico imutável de mudanças, comentários, menções e evidências.

### Recorrência

- Frequência diária, semanal ou em dias específicos.
- Cada ocorrência possui histórico independente.
- Alterações do modelo atingem somente ocorrências futuras.
- Ocorrências podem ser editadas ou canceladas sem mudar a série.

### Escala

- Turnos, folgas e substituições, sem controle de ponto ou banco de horas.
- Responsável não escalado envia a ocorrência à fila do setor.

### Tempo e indicadores

- Cronômetro entre início e conclusão.
- Períodos bloqueados não contam como duração ativa.
- Indicadores de previstas, iniciadas, concluídas no prazo, atrasadas, bloqueadas e aguardando validação.
- Filtros por período, setor, responsável e modelo, com exportação CSV.

### Offline

- Consulta das tarefas do dia sem conexão.
- Início, checklist, notas, evidências e conclusão entram em fila local.
- Sincronização idempotente ao reconectar.
- Conflitos nunca sobrescrevem silenciosamente uma versão mais recente.

## 7. Requisitos não funcionais

- Interface responsiva, instalável e acessível por teclado e toque.
- Idioma `pt-BR`, moeda BRL e fuso `America/Sao_Paulo`.
- RLS aplicada a todas as tabelas expostas pelo Supabase.
- Evidências em armazenamento privado com acesso temporário.
- Evidências aceitam JPEG, PNG e WebP de até 10 MB; o cliente converte para WebP de até 2 MB e 1920 px, com exigência de uma a cinco fotos por tarefa.
- O PIN bloqueia por 15 minutos após cinco tentativas inválidas consecutivas; o evento é auditado e o gestor pode desbloquear antecipadamente.
- Fotos e histórico pessoal retidos por 12 meses; após isso, fotos são removidas e dados pessoais antigos são anonimizados.
- Eventos técnicos devem possuir identificador rastreável para suporte.

## 8. Métricas e notificações

- Duração ativa e tempo bloqueado são métricas separadas.
- Execuções individuais de tarefa coletiva são medidas separadamente.
- Cancelamentos permanecem no histórico, mas não entram nas taxas operacionais.
- Alertas padrão: executor 15 minutos antes; líder imediatamente no atraso ou bloqueio; gestor após 30 minutos sem resolução.
- Push é complementar; a central interna é a fonte confiável.

## 9. Fora do MVP

- Múltiplas lojas ou filiais em operação.
- ERP, RH, importação externa e controle formal de ponto.
- WhatsApp, chat geral, ranking, gamificação e relatórios PDF.
- Aplicativos Android ou iOS nativos.

## 10. Critérios de sucesso

- Piloto com um setor por 14 dias.
- Nenhuma perda de dados, violação de permissão ou falha crítica durante o piloto.
- Fluxos de criação, execução, evidência, bloqueio, validação, offline e notificação usados em operação real.
- Expansão para a loja somente após aceite do gestor e atendimento dos critérios acima.

## 11. Documentação relacionada

Consulte o índice em [docs/README.md](docs/README.md).
