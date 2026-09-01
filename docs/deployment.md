# Implantação e operação

## Ambientes

- **Desenvolvimento:** Next.js local conectado a um projeto Supabase remoto de desenvolvimento com dados fictícios.
- **Preview:** implantação por mudança para validação funcional, sem dados reais.
- **Produção:** Vercel e projeto Supabase dedicado.

Desenvolvimento, Preview e Produção não devem compartilhar banco, Storage, chaves VAPID nem segredos.

## Pipeline

1. Instalar dependências com lockfile.
2. Executar checagem de tipos, lint e testes unitários.
3. Validar migrations e testes de integração/RLS.
4. Gerar build de produção.
5. Executar testes funcionais no ambiente apropriado.
6. Promover somente com todos os gates aprovados.

## Migrations

- Versionadas, revisáveis e compatíveis com a versão atual da aplicação durante rollout.
- Nunca executar alteração destrutiva sem backup e estratégia de retorno.
- Produção recebe migration antes da funcionalidade que depende dela, quando necessário.

## Observabilidade

- Erros de aplicação e identificadores de correlação.
- Execução e falhas de jobs.
- Tamanho e idade da fila de sincronização.
- Falhas e latência de upload.
- Entrega de notificações e assinaturas inválidas.
- Violações ou recusas relevantes de autorização sem registrar segredos.

## Recuperação

- Backups e restauração do banco devem ser testados antes do piloto.
- Jobs podem ser repetidos com segurança.
- Rollback da aplicação não deve depender de apagar dados.
- Incidentes críticos interrompem a expansão do piloto até correção e nova validação.
