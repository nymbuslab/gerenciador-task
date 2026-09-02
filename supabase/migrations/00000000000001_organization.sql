-- Schema organizacional da loja e matriz de autorizacao por papel e setor.
-- Referencias: docs/database.md, docs/auth-security.md, PRD.md secao 4.

create schema if not exists app;

comment on schema app is
  'Funcoes internas de autorizacao. Nao e exposta pela API e nao guarda dados.';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'papel_membro') then
    create type public.papel_membro as enum ('gestor', 'lider', 'funcionario');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

comment on table public.stores is 'Loja atendida; preparada para filiais futuras sem singleton global.';

create table if not exists public.sectors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (store_id, nome)
);

comment on table public.sectors is 'Setores pertencentes a loja; exclusao e funcional via archived_at.';

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  usuario text not null check (usuario ~ '^[a-z0-9._-]{3,40}$'),
  email text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (store_id, usuario)
);

comment on table public.profiles is 'Dados operacionais ligados a identidade autenticada do Supabase.';

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  sector_id uuid references public.sectors (id) on delete restrict,
  papel public.papel_membro not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint memberships_setor_conforme_papel check (
    (papel = 'gestor' and sector_id is null)
    or (papel <> 'gestor' and sector_id is not null)
  )
);

comment on table public.memberships is 'Papel e vinculo de uma pessoa com loja e setor.';

create unique index if not exists memberships_vinculo_ativo_unico
  on public.memberships (profile_id)
  where ativo;

create index if not exists sectors_por_loja on public.sectors (store_id) where archived_at is null;
create index if not exists profiles_por_loja on public.profiles (store_id) where archived_at is null;
create index if not exists memberships_por_setor on public.memberships (sector_id) where ativo;
create index if not exists memberships_por_loja_papel on public.memberships (store_id, papel) where ativo;

-- ---------------------------------------------------------------------------
-- Trilha de atualizacao
-- ---------------------------------------------------------------------------

create or replace function app.tocar_registro()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists stores_tocar on public.stores;
create trigger stores_tocar before update on public.stores
  for each row execute function app.tocar_registro();

drop trigger if exists sectors_tocar on public.sectors;
create trigger sectors_tocar before update on public.sectors
  for each row execute function app.tocar_registro();

drop trigger if exists profiles_tocar on public.profiles;
create trigger profiles_tocar before update on public.profiles
  for each row execute function app.tocar_registro();

drop trigger if exists memberships_tocar on public.memberships;
create trigger memberships_tocar before update on public.memberships
  for each row execute function app.tocar_registro();

-- ---------------------------------------------------------------------------
-- Funcoes de autorizacao
--
-- Sao SECURITY DEFINER de proposito: as politicas precisam consultar o vinculo
-- do solicitante sem reentrar na RLS das mesmas tabelas, o que causaria
-- recursao infinita. Cada funcao le apenas o vinculo ativo de auth.uid().
-- ---------------------------------------------------------------------------

create or replace function app.perfil_atual()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.archived_at is null
  limit 1;
$$;

create or replace function app.loja_atual()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.store_id
  from public.memberships m
  join public.profiles p on p.id = m.profile_id
  where p.auth_user_id = auth.uid()
    and p.archived_at is null
    and m.ativo
  limit 1;
$$;

create or replace function app.setor_atual()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.sector_id
  from public.memberships m
  join public.profiles p on p.id = m.profile_id
  where p.auth_user_id = auth.uid()
    and p.archived_at is null
    and m.ativo
  limit 1;
$$;

create or replace function app.papel_atual()
returns public.papel_membro
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.papel
  from public.memberships m
  join public.profiles p on p.id = m.profile_id
  where p.auth_user_id = auth.uid()
    and p.archived_at is null
    and m.ativo
  limit 1;
$$;

create or replace function app.e_gestor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(app.papel_atual() = 'gestor', false);
$$;

create or replace function app.perfil_no_meu_setor(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    where m.profile_id = p_perfil
      and m.ativo
      and m.sector_id is not null
      and m.sector_id = app.setor_atual()
  );
$$;

revoke execute on all functions in schema app from public;
grant usage on schema app to authenticated;
grant execute on function
  app.perfil_atual(),
  app.loja_atual(),
  app.setor_atual(),
  app.papel_atual(),
  app.e_gestor(),
  app.perfil_no_meu_setor(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Nenhuma tabela concede privilegio a anon: a operacao exige sessao.
-- ---------------------------------------------------------------------------

alter table public.stores enable row level security;
alter table public.sectors enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

grant select on public.stores to authenticated;
grant update on public.stores to authenticated;
grant select, insert, update, delete on public.sectors to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;

grant all on public.stores, public.sectors, public.profiles, public.memberships to service_role;

-- O Supabase concede privilegios a anon por default privilege no schema public.
-- Aqui isso e revogado: sem sessao nao ha leitura organizacional, e a negacao
-- acontece no privilegio, nao apenas na politica.
revoke all on public.stores, public.sectors, public.profiles, public.memberships from anon;
revoke all on schema app from anon;
revoke execute on all functions in schema app from anon;

-- stores ---------------------------------------------------------------------

drop policy if exists stores_leitura_da_propria_loja on public.stores;
create policy stores_leitura_da_propria_loja on public.stores
  for select to authenticated
  using (id = app.loja_atual());

drop policy if exists stores_gestor_edita on public.stores;
create policy stores_gestor_edita on public.stores
  for update to authenticated
  using (id = app.loja_atual() and app.e_gestor())
  with check (id = app.loja_atual() and app.e_gestor());

-- sectors --------------------------------------------------------------------

drop policy if exists sectors_leitura_por_papel on public.sectors;
create policy sectors_leitura_por_papel on public.sectors
  for select to authenticated
  using (
    store_id = app.loja_atual()
    and (app.e_gestor() or id = app.setor_atual())
  );

drop policy if exists sectors_gestor_cria on public.sectors;
create policy sectors_gestor_cria on public.sectors
  for insert to authenticated
  with check (store_id = app.loja_atual() and app.e_gestor());

drop policy if exists sectors_gestor_edita on public.sectors;
create policy sectors_gestor_edita on public.sectors
  for update to authenticated
  using (store_id = app.loja_atual() and app.e_gestor())
  with check (store_id = app.loja_atual() and app.e_gestor());

drop policy if exists sectors_gestor_remove on public.sectors;
create policy sectors_gestor_remove on public.sectors
  for delete to authenticated
  using (store_id = app.loja_atual() and app.e_gestor());

-- profiles -------------------------------------------------------------------

drop policy if exists profiles_leitura_por_papel on public.profiles;
create policy profiles_leitura_por_papel on public.profiles
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or (
      store_id = app.loja_atual()
      and (app.e_gestor() or app.perfil_no_meu_setor(id))
    )
  );

drop policy if exists profiles_gestor_cadastra on public.profiles;
create policy profiles_gestor_cadastra on public.profiles
  for insert to authenticated
  with check (store_id = app.loja_atual() and app.e_gestor());

drop policy if exists profiles_gestor_edita on public.profiles;
create policy profiles_gestor_edita on public.profiles
  for update to authenticated
  using (store_id = app.loja_atual() and app.e_gestor())
  with check (store_id = app.loja_atual() and app.e_gestor());

drop policy if exists profiles_gestor_remove on public.profiles;
create policy profiles_gestor_remove on public.profiles
  for delete to authenticated
  using (store_id = app.loja_atual() and app.e_gestor());

-- memberships ----------------------------------------------------------------

drop policy if exists memberships_leitura_por_papel on public.memberships;
create policy memberships_leitura_por_papel on public.memberships
  for select to authenticated
  using (
    store_id = app.loja_atual()
    and (
      app.e_gestor()
      or profile_id = app.perfil_atual()
      or (sector_id is not null and sector_id = app.setor_atual())
    )
  );

drop policy if exists memberships_gestor_vincula on public.memberships;
create policy memberships_gestor_vincula on public.memberships
  for insert to authenticated
  with check (store_id = app.loja_atual() and app.e_gestor());

drop policy if exists memberships_gestor_edita on public.memberships;
create policy memberships_gestor_edita on public.memberships
  for update to authenticated
  using (store_id = app.loja_atual() and app.e_gestor())
  with check (store_id = app.loja_atual() and app.e_gestor());

drop policy if exists memberships_gestor_remove on public.memberships;
create policy memberships_gestor_remove on public.memberships
  for delete to authenticated
  using (store_id = app.loja_atual() and app.e_gestor());

notify pgrst, 'reload schema';
