create table if not exists public.integration_probe (
  id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.integration_probe enable row level security;

grant select on public.integration_probe to anon, authenticated;
grant all on public.integration_probe to service_role;

comment on table public.integration_probe is
  'Sentinela removível usada apenas pelo harness de integração e RLS.';
