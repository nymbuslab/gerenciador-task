-- Criacao de tarefa com publico e execucoes materializados.
-- Referencias: docs/tasks-workflows.md secao Publico e conclusao, decisoes D-04 e D-05.
--
-- Publico e execucoes nascem na mesma transacao da ocorrencia. Materializar
-- depois deixaria a tarefa existindo sem ninguem para executa-la, e a fila do
-- setor mostraria um trabalho que nao chegou a ser distribuido.

create or replace function public.criar_tarefa(
  p_titulo text,
  p_publico public.publico_tarefa,
  p_setor uuid default null,
  p_modo public.modo_conclusao default 'individual',
  p_destinatarios uuid[] default '{}',
  p_instrucoes text default null,
  p_prioridade public.prioridade_tarefa default 'normal',
  p_prazo timestamptz default null,
  p_exige_checklist boolean default false,
  p_itens_checklist text[] default '{}',
  p_exige_foto boolean default false,
  p_fotos_minimas integer default 0,
  p_exige_observacao boolean default false,
  p_exige_aprovacao boolean default false
)
returns table (ocorrencia_id uuid, execucoes integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_loja uuid := app.loja_atual();
  v_ocorrencia public.task_occurrences;
  v_perfil uuid;
  v_execucao uuid;
  v_execucoes integer := 0;
  v_item text;
  v_ordem integer;
begin
  insert into public.task_occurrences (
    store_id, sector_id, titulo, instrucoes, prioridade, publico, modo_conclusao,
    prazo, exige_checklist, exige_foto, fotos_minimas, exige_observacao,
    exige_aprovacao, criado_por
  )
  values (
    v_loja,
    case when p_publico = 'todos' then null else p_setor end,
    p_titulo, p_instrucoes, p_prioridade, p_publico, p_modo,
    p_prazo, p_exige_checklist, p_exige_foto, p_fotos_minimas, p_exige_observacao,
    p_exige_aprovacao, app.perfil_atual()
  )
  returning * into v_ocorrencia;

  -- Publico resolvido agora, e nao no momento da execucao: mudanca de equipe
  -- depois nao pode reescrever quem recebeu a tarefa de hoje.
  insert into public.task_recipients (occurrence_id, profile_id)
  select v_ocorrencia.id, m.profile_id
  from public.memberships m
  join public.profiles pr on pr.id = m.profile_id
  where m.store_id = v_loja
    and m.ativo
    and pr.archived_at is null
    and m.papel <> 'gestor'
    and (
      (p_publico = 'pessoa' and m.profile_id = any (p_destinatarios))
      or (p_publico = 'setor' and m.sector_id = p_setor)
      or (p_publico = 'todos')
    )
  on conflict do nothing;

  if p_modo = 'coletiva' then
    insert into public.task_executions (occurrence_id, store_id, sector_id, compartilhada)
    values (v_ocorrencia.id, v_loja, v_ocorrencia.sector_id, true)
    returning id into v_execucao;

    v_execucoes := 1;

    if p_exige_checklist then
      v_ordem := 0;
      foreach v_item in array coalesce(p_itens_checklist, '{}')
      loop
        insert into public.checklist_items (execution_id, ordem, descricao)
        values (v_execucao, v_ordem, v_item);
        v_ordem := v_ordem + 1;
      end loop;
    end if;
  else
    for v_perfil in
      select r.profile_id from public.task_recipients r where r.occurrence_id = v_ocorrencia.id
    loop
      insert into public.task_executions
        (occurrence_id, store_id, sector_id, responsavel_perfil_id, compartilhada)
      values (v_ocorrencia.id, v_loja, v_ocorrencia.sector_id, v_perfil, false)
      returning id into v_execucao;

      v_execucoes := v_execucoes + 1;

      if p_exige_checklist then
        v_ordem := 0;
        foreach v_item in array coalesce(p_itens_checklist, '{}')
        loop
          insert into public.checklist_items (execution_id, ordem, descricao)
          values (v_execucao, v_ordem, v_item);
          v_ordem := v_ordem + 1;
        end loop;
      end if;

      perform app.notificar(
        v_loja, v_perfil, 'tarefa_atribuida',
        'Nova tarefa: ' || p_titulo, p_instrucoes, 'task_executions', v_execucao
      );
    end loop;
  end if;

  perform app.registrar_evento_execucao(
    v_loja, app.perfil_atual(), 'tarefa_criada', v_ocorrencia.id,
    jsonb_build_object('publico', p_publico, 'modo', p_modo, 'execucoes', v_execucoes)
  );

  return query select v_ocorrencia.id, v_execucoes;
end;
$$;

revoke execute on function public.criar_tarefa(
  text, public.publico_tarefa, uuid, public.modo_conclusao, uuid[], text,
  public.prioridade_tarefa, timestamptz, boolean, text[], boolean, integer, boolean, boolean
) from anon;

grant execute on function public.criar_tarefa(
  text, public.publico_tarefa, uuid, public.modo_conclusao, uuid[], text,
  public.prioridade_tarefa, timestamptz, boolean, text[], boolean, integer, boolean, boolean
) to authenticated;

notify pgrst, 'reload schema';
