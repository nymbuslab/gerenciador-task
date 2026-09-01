# Offline e sincronização

## Escopo offline

O dispositivo mantém dados necessários ao dia atual e permite iniciar, preencher checklist, adicionar nota/evidência, bloquear e concluir. Administração, recorrências, escala e relatórios exigem conexão.

## Armazenamento local

- IndexedDB guarda snapshot autorizado, fila de comandos e arquivos aguardando upload.
- Dados locais são separados por identidade e limpos no logout.
- Conteúdo sensível não deve ser persistido além do necessário para a operação offline.

## Comando de sincronização

Cada comando contém:

- `command_id` UUID gerado no dispositivo;
- tipo da ação;
- entidade e identificador;
- versão esperada;
- instante local informativo;
- payload validado;
- referência local de evidência, quando aplicável.

O servidor registra `command_id` por usuário e devolve o mesmo resultado em repetição. O horário confiável da operação é o do servidor; o instante local fica apenas para diagnóstico.

## Ordem e conflitos

- Comandos de uma mesma execução são enviados em ordem.
- Upload exigido termina antes do comando de conclusão.
- Versão incompatível, perda de permissão, cancelamento ou reatribuição provoca conflito explícito.
- O cliente atualiza o snapshot e orienta o usuário; nunca sobrescreve o servidor automaticamente.
- Falhas temporárias usam nova tentativa com backoff; erros definitivos saem da fila e exigem ação.

## Experiência

- Indicador persistente de offline, sincronizando, sincronizado ou com erro.
- Ações enfileiradas recebem confirmação local sem fingir confirmação do servidor.
- Fechar ou atualizar a PWA não perde a fila.

