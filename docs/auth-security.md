# Autenticação e segurança

## Autenticação

- Funcionário entra com nome de usuário e PIN de seis dígitos.
- O servidor resolve o nome para uma identidade Supabase interna; essa identidade não é exibida como e-mail ao usuário.
- Líderes e gestor usam senha forte.
- Após cinco tentativas inválidas consecutivas, o acesso por PIN fica bloqueado por 15 minutos.
- O bloqueio é auditado e pode ser removido antecipadamente pelo gestor.
- Gestor pode redefinir o acesso; PIN ou senha nunca são armazenados em texto aberto.

## Primeiro acesso

- Um assistente de configuração fica disponível somente enquanto não existir loja/gestor.
- A conclusão cria a loja e o primeiro gestor em operação atômica e registra auditoria.
- Depois da criação, nova tentativa retorna indisponível e não recria nem substitui o gestor.
- Funcionários, líderes e gestores adicionais são cadastrados por gestor autenticado.

## Autorização

- A interface esconde ações indevidas, mas a autorização efetiva ocorre no servidor e na RLS.
- Funcionário atua somente em execuções elegíveis.
- Líder administra somente o setor em que possui papel ativo.
- Gestor administra toda a loja.
- Operações administrativas com Service Role nunca são chamadas diretamente pelo navegador.

## Evidências e privacidade

- Bucket privado, caminho não enumerável e URL assinada de curta duração.
- Upload aceita JPEG, PNG e WebP com até 10 MB por arquivo.
- O cliente converte a imagem para WebP com no máximo 2 MB e 1920 px; uma tarefa pode exigir de uma a cinco fotos.
- Fotos são removidas após 12 meses; dados pessoais antigos são anonimizados e métricas agregadas permanecem.
- Coletar somente dados necessários à operação; não implementar monitoramento oculto ou ranking.

## Auditoria

Registrar ator, ação, entidade, instante, contexto anterior/novo necessário e identificador técnico. Eventos incluem login administrativo, redefinição de acesso, mudanças de permissão, reatribuição, cancelamento, bloqueio, conclusão e validação.

## Ameaças prioritárias

- Escalada de privilégio entre funcionário, líder e gestor.
- Acesso cruzado entre setores.
- Repetição de mutação offline ou replay de comando.
- Enumeração de usuários e força bruta de PIN.
- Exposição de foto por URL pública.
- Alteração ou exclusão do histórico de auditoria.
