-- Protecao do acesso por PIN: contagem, bloqueio temporario, auditoria e
-- desbloqueio pelo gestor. Referencias: decisao D-25 e docs/auth-security.md.
--
-- A contagem e por identificador digitado, nao por perfil. Um usuario que nao
-- existe acumula tentativas do mesmo jeito, para que a tela de entrada nao
-- funcione como sonda de quem trabalha na loja.

create table if not exists public.pin_attempts (
  identificador text primary key check (length(btrim(identificador)) between 1 and 80),
  profile_id uuid references public.profiles (id) on delete cascade,
  tentativas integer not null default 0 check (tentativas >= 0),
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

comment on table public.pin_attempts is
  'Tentativas de acesso por PIN. Nunca guarda o segredo digitado.';

create index if not exists pin_attempts_por_perfil on public.pin_attempts (profile_id);

alter table public.pin_attempts enable row level security;

revoke all on public.pin_attempts from anon, authenticated;
grant all on public.pin_attempts to service_role;

-- ---------------------------------------------------------------------------
-- Parametros da politica
-- ---------------------------------------------------------------------------

create or replace function app.pin_maximo_tentativas() returns integer
language sql immutable as $$ select 5; $$;

create or replace function app.pin_minutos_bloqueio() returns integer
language sql immutable as $$ select 15; $$;

-- ---------------------------------------------------------------------------
-- Consulta e registro
-- ---------------------------------------------------------------------------

create or replace function public.estado_pin(p_identificador text)
returns table (bloqueado boolean, liberado_em timestamptz, tentativas integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(a.bloqueado_ate > now(), false) as bloqueado,
    case when a.bloqueado_ate > now() then a.bloqueado_ate end as liberado_em,
    coalesce(a.tentativas, 0) as tentativas
  from (select lower(btrim(p_identificador)) as chave) entrada
  left join public.pin_attempts a on a.identificador = entrada.chave;
$$;

create or replace function public.registrar_tentativa_pin(
  p_identificador text,
  p_profile_id uuid,
  p_sucesso boolean
)
returns table (bloqueado boolean, liberado_em timestamptz, tentativas integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave text := lower(btrim(p_identificador));
  v_tentativas integer;
  v_bloqueado_ate timestamptz;
  v_loja uuid;
begin
  if p_sucesso then
    delete from public.pin_attempts where identificador = v_chave;
    return query select false, null::timestamptz, 0;
    return;
  end if;

  insert into public.pin_attempts (identificador, profile_id, tentativas, atualizado_em)
  values (v_chave, p_profile_id, 1, now())
  on conflict (identificador) do update
    set tentativas = public.pin_attempts.tentativas + 1,
        profile_id = coalesce(excluded.profile_id, public.pin_attempts.profile_id),
        atualizado_em = now()
  returning public.pin_attempts.tentativas into v_tentativas;

  if v_tentativas >= app.pin_maximo_tentativas() then
    v_bloqueado_ate := now() + make_interval(mins => app.pin_minutos_bloqueio());

    update public.pin_attempts
      set bloqueado_ate = v_bloqueado_ate
      where identificador = v_chave;

    if p_profile_id is not null then
      select store_id into v_loja from public.profiles where id = p_profile_id;
    end if;

    insert into public.audit_events (store_id, ator_perfil_id, acao, entidade, entidade_id, contexto)
    values (
      v_loja,
      p_profile_id,
      'pin_bloqueado',
      'profiles',
      p_profile_id,
      jsonb_build_object('tentativas', v_tentativas, 'liberado_em', v_bloqueado_ate)
    );
  end if;

  return query
    select coalesce(v_bloqueado_ate > now(), false), v_bloqueado_ate, v_tentativas;
end;
$$;

create or replace function public.desbloquear_pin(
  p_profile_id uuid,
  p_ator_perfil_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja uuid;
begin
  delete from public.pin_attempts where profile_id = p_profile_id;

  select store_id into v_loja from public.profiles where id = p_profile_id;

  insert into public.audit_events (store_id, ator_perfil_id, acao, entidade, entidade_id, contexto)
  values (v_loja, p_ator_perfil_id, 'pin_desbloqueado', 'profiles', p_profile_id, '{}'::jsonb);
end;
$$;

revoke execute on function
  public.estado_pin(text),
  public.registrar_tentativa_pin(text, uuid, boolean),
  public.desbloquear_pin(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.estado_pin(text),
  public.registrar_tentativa_pin(text, uuid, boolean),
  public.desbloquear_pin(uuid, uuid)
to service_role;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Redefinicao de acesso pelo gestor
-- ---------------------------------------------------------------------------

create or replace function public.redefinir_pin(
  p_profile_id uuid,
  p_ator_perfil_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loja uuid;
begin
  delete from public.pin_attempts where profile_id = p_profile_id;

  select store_id into v_loja from public.profiles where id = p_profile_id;

  insert into public.audit_events (store_id, ator_perfil_id, acao, entidade, entidade_id, contexto)
  values (v_loja, p_ator_perfil_id, 'pin_redefinido', 'profiles', p_profile_id, '{}'::jsonb);
end;
$$;

revoke execute on function public.redefinir_pin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.redefinir_pin(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
