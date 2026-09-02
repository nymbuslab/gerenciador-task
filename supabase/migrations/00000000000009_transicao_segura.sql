-- Fecha dois furos de autorizacao em aplicar_transicao_tarefa.
--
-- 1. Quem executou aprovava a propria tarefa. A politica de UPDATE de
--    task_executions libera o responsavel a escrever na propria linha, e a
--    checagem de papel vivia so em acoesDisponiveis, que apenas esconde o
--    botao. Chamada direta a funcao pulava a tela inteira.
-- 2. O proximo estado vinha do cliente em p_campos. Dava para saltar de
--    pendente para concluida sem nunca executar.
--
-- A regra de transicao continua no dominio em TypeScript, que e onde ela
-- serve a experiencia. Aqui ela vira a segunda barreira, a que vale.
-- Referencias: PRD.md secao 4, docs/tasks-workflows.md, regra 4 do CLAUDE.md.

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
  v_alvo public.task_executions;
  v_atual public.task_executions;
  v_estado public.estado_execucao;
  v_exige_aprovacao boolean;
  v_titulo text;
  v_destinatario uuid;
begin
  -- A RLS de leitura ja decide o que existe para quem chama: linha invisivel e
  -- linha inexistente sao a mesma resposta, e nenhuma das duas revela nada.
  select * into v_alvo from public.task_executions where task_executions.id = p_execucao;

  if not found then
    raise exception 'execucao fora do alcance desta sessao' using errcode = '42501';
  end if;

  if v_alvo.version <> p_versao_esperada then
    raise exception 'transicao recusada: versao divergente' using errcode = 'P0002';
  end if;

  select o.exige_aprovacao, o.titulo
    into v_exige_aprovacao, v_titulo
  from public.task_occurrences o
  where o.id = v_alvo.occurrence_id;

  -- O proximo estado e derivado da acao e do estado gravado, nunca do que o
  -- cliente mandou. p_campos so carrega marcos de tempo e motivo.
  v_estado := case
    when p_acao = 'iniciar' and v_alvo.estado = 'pendente' then 'em_execucao'
    when p_acao = 'bloquear' and v_alvo.estado = 'em_execucao' then 'bloqueada'
    when p_acao = 'retomar' and v_alvo.estado = 'bloqueada' then 'em_execucao'
    when p_acao = 'concluir' and v_alvo.estado = 'em_execucao' then
      case when coalesce(v_exige_aprovacao, false) then 'aguardando_validacao' else 'concluida' end
    when p_acao = 'aprovar' and v_alvo.estado = 'aguardando_validacao' then 'concluida'
    when p_acao = 'reprovar' and v_alvo.estado = 'aguardando_validacao' then 'em_execucao'
    when p_acao = 'cancelar'
      and v_alvo.estado in ('pendente', 'em_execucao', 'bloqueada', 'aguardando_validacao')
      then 'cancelada'
  end::public.estado_execucao;

  if v_estado is null then
    raise exception 'a acao % nao se aplica ao estado %', p_acao, v_alvo.estado
      using errcode = '42501';
  end if;

  if p_acao in ('aprovar', 'reprovar') then
    -- Validar e ato de quem lidera o setor da execucao, ou do gestor da loja.
    if not (
      app.e_gestor()
      or (app.papel_atual() = 'lider' and v_alvo.sector_id is not null
          and v_alvo.sector_id = app.setor_atual())
    ) then
      raise exception 'somente o gestor ou o lider do setor valida esta tarefa'
        using errcode = '42501';
    end if;

    -- Ninguem valida o proprio trabalho, nem na execucao individual nem na
    -- compartilhada, onde o destinatario e quem executou.
    if v_alvo.responsavel_perfil_id is not null
       and v_alvo.responsavel_perfil_id = app.perfil_atual() then
      raise exception 'quem executou a tarefa nao valida a propria entrega'
        using errcode = '42501';
    end if;

    if v_alvo.compartilhada and app.sou_destinatario(v_alvo.occurrence_id) then
      raise exception 'quem executou a tarefa nao valida a propria entrega'
        using errcode = '42501';
    end if;

    if p_acao = 'reprovar'
       and length(btrim(coalesce(p_campos ->> 'reprovacao_motivo', ''))) = 0 then
      raise exception 'a reprovacao exige justificativa' using errcode = '42501';
    end if;
  end if;

  update public.task_executions set
    estado = v_estado,
    iniciada_em = nullif(p_campos ->> 'iniciada_em', '')::timestamptz,
    faixa_ativa_desde = nullif(p_campos ->> 'faixa_ativa_desde', '')::timestamptz,
    bloqueada_em = nullif(p_campos ->> 'bloqueada_em', '')::timestamptz,
    bloqueio_motivo = nullif(p_campos ->> 'bloqueio_motivo', ''),
    segundos_ativos = greatest((p_campos ->> 'segundos_ativos')::integer, 0),
    segundos_bloqueados = greatest((p_campos ->> 'segundos_bloqueados')::integer, 0),
    validacao_solicitada_em = nullif(p_campos ->> 'validacao_solicitada_em', '')::timestamptz,
    reprovacao_motivo = nullif(p_campos ->> 'reprovacao_motivo', ''),
    concluida_em = case when v_estado = 'concluida' then coalesce(
      nullif(p_campos ->> 'concluida_em', '')::timestamptz, now()
    ) end,
    cancelada_em = case when v_estado = 'cancelada' then coalesce(
      nullif(p_campos ->> 'cancelada_em', '')::timestamptz, now()
    ) end,
    validada_por = case
      when p_acao in ('aprovar', 'reprovar') then app.perfil_atual()
      else validada_por
    end,
    validada_em = case when p_acao = 'aprovar' then now() else validada_em end
  where task_executions.id = p_execucao
    and task_executions.version = p_versao_esperada
  returning * into v_atual;

  if not found then
    raise exception 'transicao recusada: versao divergente' using errcode = 'P0002';
  end if;

  perform app.registrar_evento_execucao(
    v_atual.store_id,
    app.perfil_atual(),
    'execucao_' || p_acao,
    v_atual.id,
    jsonb_build_object('estado', v_atual.estado, 'versao', v_atual.version)
  );

  if p_acao in ('aprovar', 'reprovar') then
    if v_atual.responsavel_perfil_id is not null then
      perform app.notificar(
        v_atual.store_id,
        v_atual.responsavel_perfil_id,
        'validacao_' || p_acao,
        case p_acao
          when 'aprovar' then 'Tarefa aprovada: ' || coalesce(v_titulo, 'sem titulo')
          else 'Tarefa devolvida: ' || coalesce(v_titulo, 'sem titulo')
        end,
        v_atual.reprovacao_motivo,
        'task_executions',
        v_atual.id
      );
    else
      for v_destinatario in
        select r.profile_id
        from public.task_recipients r
        where r.occurrence_id = v_atual.occurrence_id
      loop
        perform app.notificar(
          v_atual.store_id,
          v_destinatario,
          'validacao_' || p_acao,
          case p_acao
            when 'aprovar' then 'Tarefa aprovada: ' || coalesce(v_titulo, 'sem titulo')
            else 'Tarefa devolvida: ' || coalesce(v_titulo, 'sem titulo')
          end,
          v_atual.reprovacao_motivo,
          'task_executions',
          v_atual.id
        );
      end loop;
    end if;
  end if;

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
