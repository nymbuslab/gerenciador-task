-- Trilha de auditoria e trava permanente do assistente de configuracao inicial.
-- Referencias: docs/auth-security.md secao Primeiro acesso, decisao D-28.

-- ---------------------------------------------------------------------------
-- Auditoria (somente insercao pelo servidor)
-- ---------------------------------------------------------------------------

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete cascade,
  ator_perfil_id uuid references public.profiles (id) on delete set null,
  acao text not null check (length(btrim(acao)) between 1 and 80),
  entidade text not null check (length(btrim(entidade)) between 1 and 80),
  entidade_id uuid,
  contexto jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_events is
  'Linha do tempo imutavel de acoes relevantes. Escrita apenas pelo servidor.';

create index if not exists audit_events_por_loja_data
  on public.audit_events (store_id, created_at desc);

alter table public.audit_events enable row level security;

grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
revoke all on public.audit_events from anon;

drop policy if exists audit_events_gestor_le on public.audit_events;
create policy audit_events_gestor_le on public.audit_events
  for select to authenticated
  using (store_id = app.loja_atual() and app.e_gestor());

-- ---------------------------------------------------------------------------
-- Trava do assistente
--
-- Linha unica garantida pela chave primaria booleana com check. A insercao e a
-- criacao da loja acontecem na mesma transacao: se a trava ja existe, nada e
-- criado e a solicitacao posterior e recusada.
-- ---------------------------------------------------------------------------

create table if not exists public.bootstrap_state (
  id boolean primary key default true check (id),
  store_id uuid not null references public.stores (id) on delete restrict,
  concluido_em timestamptz not null default now()
);

comment on table public.bootstrap_state is
  'Trava permanente do assistente de configuracao inicial. Nunca exposta a sessoes.';

alter table public.bootstrap_state enable row level security;

revoke all on public.bootstrap_state from anon, authenticated;
grant all on public.bootstrap_state to service_role;

-- ---------------------------------------------------------------------------
-- Conclusao atomica do assistente
-- ---------------------------------------------------------------------------

create or replace function public.concluir_bootstrap(
  p_auth_user_id uuid,
  p_loja_nome text,
  p_gestor_nome text,
  p_usuario text,
  p_email text
)
returns table (loja_id uuid, perfil_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja_id uuid;
  v_perfil_id uuid;
begin
  -- Serializa as solicitacoes concorrentes: sem esta trava o perdedor veria a
  -- trava ainda nao comitada, seguiria em frente e falharia por violacao de
  -- unicidade em vez de receber a recusa tratada.
  perform pg_advisory_xact_lock(hashtext('bootstrap_configuracao_inicial'));

  if exists (select 1 from public.bootstrap_state) then
    raise exception 'assistente de configuracao inicial ja concluido'
      using errcode = 'P0001';
  end if;

  insert into public.stores (nome) values (btrim(p_loja_nome)) returning id into v_loja_id;

  insert into public.profiles (auth_user_id, store_id, nome, usuario, email)
  values (p_auth_user_id, v_loja_id, btrim(p_gestor_nome), lower(btrim(p_usuario)), p_email)
  returning id into v_perfil_id;

  insert into public.memberships (profile_id, store_id, sector_id, papel)
  values (v_perfil_id, v_loja_id, null, 'gestor');

  insert into public.bootstrap_state (id, store_id) values (true, v_loja_id);

  insert into public.audit_events (store_id, ator_perfil_id, acao, entidade, entidade_id, contexto)
  values (
    v_loja_id,
    v_perfil_id,
    'bootstrap_concluido',
    'stores',
    v_loja_id,
    jsonb_build_object('usuario', lower(btrim(p_usuario)))
  );

  return query select v_loja_id, v_perfil_id;
end;
$$;

revoke execute on function public.concluir_bootstrap(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.concluir_bootstrap(uuid, text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
