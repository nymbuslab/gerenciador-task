# Arquitetura e segurança

## Contrato de entrada

Sessão Supabase, comandos tipados do cliente, eventos de jobs e mutações offline com ID idempotente e versão esperada.

## Contrato de saída

Resultado autorizado da operação, evento de auditoria, notificação interna e atualização Realtime quando aplicável.

## Limites e cotas

- PIN de funcionário com seis dígitos (`docs/auth-security.md`, seção Autenticação).
- Retenção de dados pessoais e evidências por 12 meses (`PRD.md`, seção 7).
- Limites de plataforma, upload e tentativas: NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

- Conflito de versão não sobrescreve dados do servidor.
- Push indisponível mantém notificação interna.
- Repetição de comando retorna o resultado idempotente.
- Falha transitória de sincronização usa nova tentativa; erro definitivo exige ação do usuário.

## Riscos para a nossa implementação

PIN exige defesa adicional contra força bruta. Service Role no cliente causaria acesso irrestrito. Cache offline mal separado pode expor dados entre usuários no mesmo aparelho.

## Fonte

`docs/architecture.md`; `docs/auth-security.md`; `docs/offline-sync.md`; documentação Context7 consultada em 2026-09-01 — acessados em 2026-09-01.

