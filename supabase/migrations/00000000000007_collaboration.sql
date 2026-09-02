-- Comentarios, mencoes, caixa de entrada interna e decisao de validacao.
-- Referencias: decisao D-14, decisao D-17, docs/tasks-workflows.md.
--
-- A conversa fica presa a ocorrencia de proposito: o produto nao tem chat
-- geral, e uma mensagem sem tarefa perderia o contexto que a torna util.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.task_occurrences (id) on delete cascade,
  execution_id uuid references public.task_executions (id) on delete set null,
  store_id uuid not null references public.stores (id) on delete cascade,
  autor_perfil_id uuid references public.profiles (id) on delete set null,
  texto text not null check (length(btrim(texto)) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.comments is 'Conversa vinculada a uma ocorrencia de tarefa.';

create index if not exists comentarios_por_ocorrencia
  on public.comments (occurrence_id, created_at);

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, profile_id)
);

comment on table public.mentions is 'Pessoas citadas em um comentario.';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  destinatario_perfil_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (length(btrim(tipo)) between 1 and 60),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  corpo text,
  entidade text,
  entidade_id uuid,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Caixa de entrada confiavel do usuario. O Web Push da Sprint 05 apenas espelha isto.';

create index if not exists notificacoes_por_destinatario
  on public.notifications (destinatario_perfil_id, lida_em, created_at desc);

alter table public.comments enable row level security;
alter table public.mentions enable row level security;
alter table public.notifications enable row level security;

grant select, insert on public.comments to authenticated;
grant select on public.mentions to authenticated;
grant select, update on public.notifications to authenticated;
grant all on public.comments, public.mentions, public.notifications to service_role;
revoke all on public.comments, public.mentions, public.notifications from anon;

drop policy if exists comentarios_leitura on public.comments;
create policy comentarios_leitura on public.comments
  for select to authenticated
  using (app.pode_ver_ocorrencia(occurrence_id));

drop policy if exists comentarios_escrita on public.comments;
create policy comentarios_escrita on public.comments
  for insert to authenticated
  with check (
    store_id = app.loja_atual()
    and autor_perfil_id = app.perfil_atual()
    and app.pode_ver_ocorrencia(occurrence_id)
  );

drop policy if exists mencoes_leitura on public.mentions;
create policy mencoes_leitura on public.mentions
  for select to authenticated
  using (
    exists (
      select 1
      from public.comments c
      where c.id = comment_id and app.pode_ver_ocorrencia(c.occurrence_id)
    )
  );

drop policy if exists notificacoes_leitura on public.notifications;
create policy notificacoes_leitura on public.notifications
  for select to authenticated
  using (destinatario_perfil_id = app.perfil_atual());

drop policy if exists notificacoes_marcar_lida on public.notifications;
create policy notificacoes_marcar_lida on public.notifications
  for update to authenticated
  using (destinatario_perfil_id = app.perfil_atual())
  with check (destinatario_perfil_id = app.perfil_atual());

-- ---------------------------------------------------------------------------
-- Entrega de notificacao
-- ---------------------------------------------------------------------------

create or replace function app.notificar(
  p_loja uuid,
  p_destinatario uuid,
  p_tipo text,
  p_titulo text,
  p_corpo text,
  p_entidade text,
  p_entidade_id uuid
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications
    (store_id, destinatario_perfil_id, tipo, titulo, corpo, entidade, entidade_id)
  select p_loja, p_destinatario, p_tipo, p_titulo, p_corpo, p_entidade, p_entidade_id
  where p_destinatario is not null;
$$;

revoke execute on function app.notificar(uuid, uuid, text, text, text, text, uuid) from anon;
grant execute on function app.notificar(uuid, uuid, text, text, text, text, uuid) to authenticated;

-- A tabela de mencoes nao aceita escrita direta de ninguem: citar alguem so
-- acontece por dentro de `comentar`, junto do comentario que deu origem.
create or replace function app.registrar_mencao(p_comentario uuid, p_perfil uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.mentions (comment_id, profile_id)
  values (p_comentario, p_perfil)
  on conflict (comment_id, profile_id) do nothing;
$$;

revoke execute on function app.registrar_mencao(uuid, uuid) from anon;
grant execute on function app.registrar_mencao(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Comentar com mencoes
--
-- SECURITY INVOKER: quem pode comentar continua sendo decidido pela politica de
-- comments. So a gravacao das mencoes e das notificacoes usa a funcao definer,
-- porque escreve em nome de outra pessoa.
-- ---------------------------------------------------------------------------

create or replace function public.comentar(
  p_ocorrencia uuid,
  p_texto text,
  p_execucao uuid default null,
  p_mencionados uuid[] default '{}'
)
returns table (id uuid, created_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_comentario public.comments;
  v_titulo text;
  v_mencionado uuid;
begin
  insert into public.comments (occurrence_id, execution_id, store_id, autor_perfil_id, texto)
  values (p_ocorrencia, p_execucao, app.loja_atual(), app.perfil_atual(), p_texto)
  returning * into v_comentario;

  select o.titulo into v_titulo from public.task_occurrences o where o.id = p_ocorrencia;

  foreach v_mencionado in array coalesce(p_mencionados, '{}')
  loop
    -- Mencionar quem nao enxerga a tarefa vazaria o conteudo dela pela
    -- notificacao, entao a lista e filtrada pelos destinatarios da ocorrencia.
    if exists (
      select 1
      from public.task_recipients r
      where r.occurrence_id = p_ocorrencia and r.profile_id = v_mencionado
    ) then
      perform app.registrar_mencao(v_comentario.id, v_mencionado);

      perform app.notificar(
        v_comentario.store_id,
        v_mencionado,
        'mencao',
        'Você foi citado em ' || coalesce(v_titulo, 'uma tarefa'),
        left(p_texto, 160),
        'comments',
        v_comentario.id
      );
    end if;
  end loop;

  perform app.registrar_evento_execucao(
    v_comentario.store_id,
    v_comentario.autor_perfil_id,
    'comentario_publicado',
    coalesce(p_execucao, v_comentario.id),
    jsonb_build_object('ocorrencia', p_ocorrencia, 'comentario', v_comentario.id)
  );

  return query select v_comentario.id, v_comentario.created_at;
end;
$$;

revoke execute on function public.comentar(uuid, text, uuid, uuid[]) from anon;
grant execute on function public.comentar(uuid, text, uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Decisao de validacao com aviso ao executor
--
-- A notificacao entra na mesma transacao da transicao: uma reprovacao gravada
-- sem aviso deixaria a pessoa esperando por uma tarefa que voltou para ela.
-- ---------------------------------------------------------------------------

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
  v_titulo text;
  v_destinatario uuid;
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

  if p_acao in ('aprovar', 'reprovar') then
    select o.titulo into v_titulo
    from public.task_occurrences o
    where o.id = v_atual.occurrence_id;

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
