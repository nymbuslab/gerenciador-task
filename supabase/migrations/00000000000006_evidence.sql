-- Evidencias privadas e requisitos de conclusao.
-- Referencias: decisao D-24, docs/auth-security.md secao Evidencias e privacidade.
--
-- O bucket e privado e o caminho comeca pelo id da execucao, que nao e
-- adivinhavel. O acesso sai sempre por URL assinada de curta duracao; nao
-- existe leitura publica de foto de loja.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 2097152, array['image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/webp'];

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.task_executions (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  caminho text not null unique,
  tipo text not null default 'image/webp' check (tipo = 'image/webp'),
  bytes integer not null check (bytes > 0 and bytes <= 2097152),
  largura integer check (largura > 0),
  altura integer check (altura > 0),
  observacao text,
  enviada_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.evidence is
  'Metadados do arquivo privado de evidencia. O binario vive no bucket evidencias.';

create index if not exists evidencias_por_execucao on public.evidence (execution_id, created_at);

alter table public.evidence enable row level security;

grant select, insert, delete on public.evidence to authenticated;
grant all on public.evidence to service_role;
revoke all on public.evidence from anon;

drop policy if exists evidencias_leitura on public.evidence;
create policy evidencias_leitura on public.evidence
  for select to authenticated
  using (app.pode_ver_execucao(execution_id));

drop policy if exists evidencias_envio on public.evidence;
create policy evidencias_envio on public.evidence
  for insert to authenticated
  with check (store_id = app.loja_atual() and app.pode_ver_execucao(execution_id));

drop policy if exists evidencias_remocao on public.evidence;
create policy evidencias_remocao on public.evidence
  for delete to authenticated
  using (
    store_id = app.loja_atual()
    and (app.e_gestor() or enviada_por = app.perfil_atual())
  );

-- ---------------------------------------------------------------------------
-- Acesso ao bucket
-- ---------------------------------------------------------------------------

-- O primeiro trecho do caminho e o id da execucao. Caminho fora do formato
-- devolve nulo e nao casa com politica alguma.
create or replace function app.execucao_do_caminho(p_caminho text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(p_caminho))[1] ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_caminho))[1])::uuid
  end;
$$;

grant execute on function app.execucao_do_caminho(text) to authenticated;
revoke execute on function app.execucao_do_caminho(text) from anon;

drop policy if exists evidencias_objeto_leitura on storage.objects;
create policy evidencias_objeto_leitura on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and app.pode_ver_execucao(app.execucao_do_caminho(name))
  );

drop policy if exists evidencias_objeto_envio on storage.objects;
create policy evidencias_objeto_envio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and app.pode_ver_execucao(app.execucao_do_caminho(name))
  );

drop policy if exists evidencias_objeto_remocao on storage.objects;
create policy evidencias_objeto_remocao on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidencias'
    and app.pode_ver_execucao(app.execucao_do_caminho(name))
    and app.e_gestor()
  );

-- ---------------------------------------------------------------------------
-- Requisitos de conclusao
--
-- A checagem vive no banco porque precisa ler checklist, evidencias e a
-- configuracao da ocorrencia numa foto so; feita em tres consultas separadas,
-- a resposta poderia se referir a estados diferentes.
-- ---------------------------------------------------------------------------

create or replace function public.pendencias_de_conclusao(p_execucao uuid)
returns table (pendencia text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with contexto as (
    select
      e.id,
      o.exige_checklist,
      o.exige_foto,
      o.fotos_minimas,
      o.exige_observacao,
      e.observacao,
      (
        select count(*)
        from public.checklist_items c
        where c.execution_id = e.id and c.obrigatorio and not c.concluido
      ) as itens_abertos,
      (select count(*) from public.evidence v where v.execution_id = e.id) as fotos
    from public.task_executions e
    join public.task_occurrences o on o.id = e.occurrence_id
    where e.id = p_execucao
  )
  select 'checklist' from contexto where exige_checklist and itens_abertos > 0
  union all
  select 'fotos' from contexto where exige_foto and fotos < fotos_minimas
  union all
  select 'observacao' from contexto
    where exige_observacao and length(btrim(coalesce(observacao, ''))) = 0;
$$;

revoke execute on function public.pendencias_de_conclusao(uuid) from anon;
grant execute on function public.pendencias_de_conclusao(uuid) to authenticated;

notify pgrst, 'reload schema';
