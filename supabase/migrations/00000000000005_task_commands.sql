-- Aplicacao atomica de uma transicao de execucao com o evento de auditoria.
--
-- A regra de quais transicoes existem mora no dominio, em TypeScript
-- (src/features/tasks/domain.ts). Aqui o banco garante o que so ele pode:
-- que a escrita e a auditoria acontecam na mesma transacao e que ninguem
-- sobrescreva uma versao mais nova.

create or replace function app.registrar_evento_execucao(
  p_loja uuid,
  p_ator uuid,
  p_acao text,
  p_execucao uuid,
  p_contexto jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_events (store_id, ator_perfil_id, acao, entidade, entidade_id, contexto)
  values (p_loja, p_ator, p_acao, 'task_executions', p_execucao, coalesce(p_contexto, '{}'::jsonb));
$$;

revoke execute on function app.registrar_evento_execucao(uuid, uuid, text, uuid, jsonb) from anon;
grant execute on function app.registrar_evento_execucao(uuid, uuid, text, uuid, jsonb) to authenticated;

-- SECURITY INVOKER de proposito: quem decide se a pessoa pode mexer nesta
-- execucao continua sendo a politica de task_executions, e nao esta funcao.
create or replace function public.aplicar_transicao_tarefa(
  p_execucao uuid,
  p_versao_esperada integer,
  p_acao text,
  p_campos jsonb
)
returns table (
  id uuid,
  estado public.estado_execucao,
  segundos_ativos integer,
  segundos_bloqueados integer,
  concluida_em timestamptz,
  version integer
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_atual public.task_executions;
begin
  update public.task_executions set
    estado = (p_campos ->> 'estado')::public.estado_execucao,
    iniciada_em = nullif(p_campos ->> 'iniciada_em', '')::timestamptz,
    faixa_ativa_desde = nullif(p_campos ->> 'faixa_ativa_desde', '')::timestamptz,
    bloqueada_em = nullif(p_campos ->> 'bloqueada_em', '')::timestamptz,
    bloqueio_motivo = nullif(p_campos ->> 'bloqueio_motivo', ''),
    segundos_ativos = (p_campos ->> 'segundos_ativos')::integer,
    segundos_bloqueados = (p_campos ->> 'segundos_bloqueados')::integer,
    validacao_solicitada_em = nullif(p_campos ->> 'validacao_solicitada_em', '')::timestamptz,
    reprovacao_motivo = nullif(p_campos ->> 'reprovacao_motivo', ''),
    concluida_em = nullif(p_campos ->> 'concluida_em', '')::timestamptz,
    cancelada_em = nullif(p_campos ->> 'cancelada_em', '')::timestamptz,
    validada_por = case
      when p_acao in ('aprovar', 'reprovar') then app.perfil_atual()
      else validada_por
    end,
    validada_em = case when p_acao = 'aprovar' then now() else validada_em end
  where task_executions.id = p_execucao
    and task_executions.version = p_versao_esperada
  returning * into v_atual;

  if not found then
    raise exception 'transicao recusada: versao divergente ou execucao fora do alcance'
      using errcode = 'P0002';
  end if;

  perform app.registrar_evento_execucao(
    v_atual.store_id,
    app.perfil_atual(),
    'execucao_' || p_acao,
    v_atual.id,
    jsonb_build_object('estado', v_atual.estado, 'versao', v_atual.version)
  );

  return query
    select v_atual.id,
           v_atual.estado,
           v_atual.segundos_ativos,
           v_atual.segundos_bloqueados,
           v_atual.concluida_em,
           v_atual.version;
end;
$$;

revoke execute on function public.aplicar_transicao_tarefa(uuid, integer, text, jsonb) from anon;
grant execute on function public.aplicar_transicao_tarefa(uuid, integer, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
