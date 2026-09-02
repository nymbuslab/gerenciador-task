-- Modelos, ocorrencias, destinatarios, execucoes e checklist das tarefas.
-- Referencias: docs/tasks-workflows.md, docs/database.md, PRD.md secao 6.
--
-- Os destinatarios sao materializados na ocorrencia de proposito: se a equipe
-- ou a escala mudar depois, o historico continua contando quem realmente
-- recebeu aquela tarefa naquele dia.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'publico_tarefa') then
    create type public.publico_tarefa as enum ('pessoa', 'setor', 'todos');
  end if;

  if not exists (select 1 from pg_type where typname = 'modo_conclusao') then
    create type public.modo_conclusao as enum ('coletiva', 'individual');
  end if;

  if not exists (select 1 from pg_type where typname = 'prioridade_tarefa') then
    create type public.prioridade_tarefa as enum ('baixa', 'normal', 'alta');
  end if;

  if not exists (select 1 from pg_type where typname = 'estado_execucao') then
    create type public.estado_execucao as enum (
      'pendente',
      'em_execucao',
      'bloqueada',
      'aguardando_validacao',
      'concluida',
      'cancelada'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Modelos e ocorrencias
-- ---------------------------------------------------------------------------

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  sector_id uuid references public.sectors (id) on delete restrict,
  titulo text not null check (length(btrim(titulo)) between 2 and 160),
  instrucoes text,
  prioridade public.prioridade_tarefa not null default 'normal',
  publico public.publico_tarefa not null,
  modo_conclusao public.modo_conclusao not null default 'individual',
  exige_checklist boolean not null default false,
  exige_foto boolean not null default false,
  fotos_minimas integer not null default 0 check (fotos_minimas between 0 and 5),
  exige_observacao boolean not null default false,
  exige_aprovacao boolean not null default false,
  duracao_estimada_minutos integer check (duracao_estimada_minutos > 0),
  ativo boolean not null default true,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint templates_foto_coerente check (
    (exige_foto and fotos_minimas between 1 and 5) or (not exige_foto and fotos_minimas = 0)
  )
);

comment on table public.task_templates is
  'Regra reutilizavel de tarefa. A recorrencia entra na Sprint 04.';

create table if not exists public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  sector_id uuid references public.sectors (id) on delete restrict,
  template_id uuid references public.task_templates (id) on delete set null,
  titulo text not null check (length(btrim(titulo)) between 2 and 160),
  instrucoes text,
  prioridade public.prioridade_tarefa not null default 'normal',
  publico public.publico_tarefa not null,
  modo_conclusao public.modo_conclusao not null default 'individual',
  data_referencia date not null default current_date,
  janela_inicio timestamptz,
  janela_fim timestamptz,
  prazo timestamptz,
  exige_checklist boolean not null default false,
  exige_foto boolean not null default false,
  fotos_minimas integer not null default 0 check (fotos_minimas between 0 and 5),
  exige_observacao boolean not null default false,
  exige_aprovacao boolean not null default false,
  duracao_estimada_minutos integer check (duracao_estimada_minutos > 0),
  cancelada_em timestamptz,
  cancelamento_motivo text,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint ocorrencias_foto_coerente check (
    (exige_foto and fotos_minimas between 1 and 5) or (not exige_foto and fotos_minimas = 0)
  ),
  constraint ocorrencias_janela_coerente check (
    janela_inicio is null or janela_fim is null or janela_fim > janela_inicio
  ),
  constraint ocorrencias_setor_conforme_publico check (
    (publico = 'todos' and sector_id is null) or (publico <> 'todos' and sector_id is not null)
  )
);

comment on table public.task_occurrences is
  'Instancia datada de uma tarefa avulsa ou gerada por modelo.';

create table if not exists public.task_recipients (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.task_occurrences (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (occurrence_id, profile_id)
);

comment on table public.task_recipients is
  'Publico resolvido da ocorrencia, congelado no momento da criacao.';

-- ---------------------------------------------------------------------------
-- Execucoes e checklist
-- ---------------------------------------------------------------------------

create table if not exists public.task_executions (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.task_occurrences (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  sector_id uuid references public.sectors (id) on delete restrict,
  responsavel_perfil_id uuid references public.profiles (id) on delete set null,
  compartilhada boolean not null default false,
  estado public.estado_execucao not null default 'pendente',
  iniciada_em timestamptz,
  faixa_ativa_desde timestamptz,
  bloqueada_em timestamptz,
  bloqueio_motivo text,
  segundos_ativos integer not null default 0 check (segundos_ativos >= 0),
  segundos_bloqueados integer not null default 0 check (segundos_bloqueados >= 0),
  observacao text,
  validacao_solicitada_em timestamptz,
  validada_por uuid references public.profiles (id) on delete set null,
  validada_em timestamptz,
  reprovacao_motivo text,
  concluida_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint execucoes_bloqueio_tem_motivo check (
    estado <> 'bloqueada' or length(btrim(coalesce(bloqueio_motivo, ''))) > 0
  ),
  constraint execucoes_compartilhada_sem_responsavel check (
    not compartilhada or responsavel_perfil_id is null
  )
);

comment on table public.task_executions is
  'Execucao coletiva ou individual de uma ocorrencia, com tempo ativo e bloqueado.';

-- Conclusao coletiva: uma unica execucao compartilhada por ocorrencia.
create unique index if not exists execucoes_compartilhada_unica
  on public.task_executions (occurrence_id)
  where compartilhada;

-- Confirmacao individual: uma execucao por destinatario.
create unique index if not exists execucoes_individuais_unicas
  on public.task_executions (occurrence_id, responsavel_perfil_id)
  where not compartilhada and responsavel_perfil_id is not null;

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.task_executions (id) on delete cascade,
  ordem integer not null check (ordem >= 0),
  descricao text not null check (length(btrim(descricao)) between 1 and 200),
  obrigatorio boolean not null default true,
  concluido boolean not null default false,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (execution_id, ordem)
);

comment on table public.checklist_items is 'Itens e resultado de uma execucao.';

-- Indices minimos de docs/database.md
create index if not exists ocorrencias_por_loja_data
  on public.task_occurrences (store_id, data_referencia desc);
create index if not exists ocorrencias_por_setor_prazo
  on public.task_occurrences (sector_id, prazo);
create index if not exists execucoes_por_responsavel_estado
  on public.task_executions (responsavel_perfil_id, estado);
create index if not exists execucoes_por_ocorrencia
  on public.task_executions (occurrence_id);
create index if not exists destinatarios_por_perfil
  on public.task_recipients (profile_id);
create index if not exists checklist_por_execucao
  on public.checklist_items (execution_id, ordem);

-- Trilha de atualizacao
drop trigger if exists task_templates_tocar on public.task_templates;
create trigger task_templates_tocar before update on public.task_templates
  for each row execute function app.tocar_registro();

drop trigger if exists task_occurrences_tocar on public.task_occurrences;
create trigger task_occurrences_tocar before update on public.task_occurrences
  for each row execute function app.tocar_registro();

drop trigger if exists task_executions_tocar on public.task_executions;
create trigger task_executions_tocar before update on public.task_executions
  for each row execute function app.tocar_registro();

drop trigger if exists checklist_items_tocar on public.checklist_items;
create trigger checklist_items_tocar before update on public.checklist_items
  for each row execute function app.tocar_registro();

-- ---------------------------------------------------------------------------
-- Visibilidade
--
-- As funcoes sao SECURITY DEFINER porque as politicas precisam consultar
-- destinatarios e execucoes de outras tabelas; sem isso a RLS de uma tabela
-- filtraria a subconsulta da outra e o resultado ficaria menor que o devido.
-- ---------------------------------------------------------------------------

-- Le apenas task_recipients, que a RLS do proprio solicitante esconderia.
create or replace function app.sou_destinatario(p_ocorrencia uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.task_recipients r
    where r.occurrence_id = p_ocorrencia and r.profile_id = app.perfil_atual()
  );
$$;

-- Usada por quem consulta a ocorrencia a partir de outra tabela, quando a
-- linha ja existe. A politica da propria task_occurrences NAO usa esta funcao:
-- em INSERT ... RETURNING a consulta interna roda no snapshot anterior e nao
-- enxergaria a linha recem-inserida, o que recusaria a insercao valida.
create or replace function app.pode_ver_ocorrencia(p_ocorrencia uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.task_occurrences o
    where o.id = p_ocorrencia
      and o.store_id = app.loja_atual()
      and (
        app.e_gestor()
        or (app.papel_atual() = 'lider' and (o.sector_id = app.setor_atual() or o.publico = 'todos'))
        or exists (
          select 1
          from public.task_recipients r
          where r.occurrence_id = o.id and r.profile_id = app.perfil_atual()
        )
      )
  );
$$;

-- Esta nao le tabela protegida: so combina o papel ja resolvido pelas outras.
-- Por isso roda com os privilegios de quem chama, e nao do dono.
create or replace function app.pode_gerir_ocorrencia(p_setor uuid, p_publico public.publico_tarefa)
returns boolean
language sql
stable
as $$
  select coalesce(
    app.e_gestor()
      or (
        app.papel_atual() = 'lider'
        and p_publico <> 'todos'
        and p_setor = app.setor_atual()
      ),
    false
  );
$$;

create or replace function app.pode_ver_execucao(p_execucao uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.task_executions e
    where e.id = p_execucao
      and e.store_id = app.loja_atual()
      and (
        app.e_gestor()
        or (app.papel_atual() = 'lider' and e.sector_id = app.setor_atual())
        or e.responsavel_perfil_id = app.perfil_atual()
        or (
          e.compartilhada
          and exists (
            select 1
            from public.task_recipients r
            where r.occurrence_id = e.occurrence_id and r.profile_id = app.perfil_atual()
          )
        )
      )
  );
$$;

grant execute on function
  app.sou_destinatario(uuid),
  app.pode_ver_ocorrencia(uuid),
  app.pode_gerir_ocorrencia(uuid, public.publico_tarefa),
  app.pode_ver_execucao(uuid)
to authenticated;

revoke execute on function
  app.sou_destinatario(uuid),
  app.pode_ver_ocorrencia(uuid),
  app.pode_gerir_ocorrencia(uuid, public.publico_tarefa),
  app.pode_ver_execucao(uuid)
from anon;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.task_templates enable row level security;
alter table public.task_occurrences enable row level security;
alter table public.task_recipients enable row level security;
alter table public.task_executions enable row level security;
alter table public.checklist_items enable row level security;

grant select, insert, update, delete on
  public.task_templates,
  public.task_occurrences,
  public.task_recipients,
  public.task_executions,
  public.checklist_items
to authenticated;

grant all on
  public.task_templates,
  public.task_occurrences,
  public.task_recipients,
  public.task_executions,
  public.checklist_items
to service_role;

revoke all on
  public.task_templates,
  public.task_occurrences,
  public.task_recipients,
  public.task_executions,
  public.checklist_items
from anon;

-- task_templates -------------------------------------------------------------

drop policy if exists templates_leitura on public.task_templates;
create policy templates_leitura on public.task_templates
  for select to authenticated
  using (
    store_id = app.loja_atual()
    and (app.e_gestor() or sector_id = app.setor_atual() or publico = 'todos')
  );

drop policy if exists templates_escrita on public.task_templates;
create policy templates_escrita on public.task_templates
  for all to authenticated
  using (store_id = app.loja_atual() and app.pode_gerir_ocorrencia(sector_id, publico))
  with check (store_id = app.loja_atual() and app.pode_gerir_ocorrencia(sector_id, publico));

-- task_occurrences -----------------------------------------------------------

-- A condicao le as colunas da propria linha, e nao uma reconsulta a tabela.
drop policy if exists ocorrencias_leitura on public.task_occurrences;
create policy ocorrencias_leitura on public.task_occurrences
  for select to authenticated
  using (
    store_id = app.loja_atual()
    and (
      app.e_gestor()
      or (app.papel_atual() = 'lider' and (sector_id = app.setor_atual() or publico = 'todos'))
      or app.sou_destinatario(id)
    )
  );

drop policy if exists ocorrencias_criacao on public.task_occurrences;
create policy ocorrencias_criacao on public.task_occurrences
  for insert to authenticated
  with check (store_id = app.loja_atual() and app.pode_gerir_ocorrencia(sector_id, publico));

drop policy if exists ocorrencias_edicao on public.task_occurrences;
create policy ocorrencias_edicao on public.task_occurrences
  for update to authenticated
  using (store_id = app.loja_atual() and app.pode_gerir_ocorrencia(sector_id, publico))
  with check (store_id = app.loja_atual() and app.pode_gerir_ocorrencia(sector_id, publico));

drop policy if exists ocorrencias_remocao on public.task_occurrences;
create policy ocorrencias_remocao on public.task_occurrences
  for delete to authenticated
  using (store_id = app.loja_atual() and app.pode_gerir_ocorrencia(sector_id, publico));

-- task_recipients ------------------------------------------------------------

drop policy if exists destinatarios_leitura on public.task_recipients;
create policy destinatarios_leitura on public.task_recipients
  for select to authenticated
  using (app.pode_ver_ocorrencia(occurrence_id));

drop policy if exists destinatarios_escrita on public.task_recipients;
create policy destinatarios_escrita on public.task_recipients
  for all to authenticated
  using (
    exists (
      select 1
      from public.task_occurrences o
      where o.id = occurrence_id
        and o.store_id = app.loja_atual()
        and app.pode_gerir_ocorrencia(o.sector_id, o.publico)
    )
  )
  with check (
    exists (
      select 1
      from public.task_occurrences o
      where o.id = occurrence_id
        and o.store_id = app.loja_atual()
        and app.pode_gerir_ocorrencia(o.sector_id, o.publico)
    )
  );

-- task_executions ------------------------------------------------------------

drop policy if exists execucoes_leitura on public.task_executions;
create policy execucoes_leitura on public.task_executions
  for select to authenticated
  using (
    store_id = app.loja_atual()
    and (
      app.e_gestor()
      or (app.papel_atual() = 'lider' and sector_id = app.setor_atual())
      or responsavel_perfil_id = app.perfil_atual()
      or (compartilhada and app.sou_destinatario(occurrence_id))
    )
  );

drop policy if exists execucoes_criacao on public.task_executions;
create policy execucoes_criacao on public.task_executions
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.task_occurrences o
      where o.id = occurrence_id
        and o.store_id = app.loja_atual()
        and app.pode_gerir_ocorrencia(o.sector_id, o.publico)
    )
  );

drop policy if exists execucoes_edicao on public.task_executions;
create policy execucoes_edicao on public.task_executions
  for update to authenticated
  using (
    store_id = app.loja_atual()
    and (
      app.e_gestor()
      or (app.papel_atual() = 'lider' and sector_id = app.setor_atual())
      or responsavel_perfil_id = app.perfil_atual()
      or (compartilhada and app.sou_destinatario(occurrence_id))
    )
  )
  with check (
    store_id = app.loja_atual()
    and (
      app.e_gestor()
      or (app.papel_atual() = 'lider' and sector_id = app.setor_atual())
      or responsavel_perfil_id = app.perfil_atual()
      or (compartilhada and app.sou_destinatario(occurrence_id))
    )
  );

drop policy if exists execucoes_remocao on public.task_executions;
create policy execucoes_remocao on public.task_executions
  for delete to authenticated
  using (
    store_id = app.loja_atual()
    and (app.e_gestor() or (app.papel_atual() = 'lider' and sector_id = app.setor_atual()))
  );

-- checklist_items ------------------------------------------------------------

drop policy if exists checklist_leitura on public.checklist_items;
create policy checklist_leitura on public.checklist_items
  for select to authenticated
  using (app.pode_ver_execucao(execution_id));

drop policy if exists checklist_escrita on public.checklist_items;
create policy checklist_escrita on public.checklist_items
  for all to authenticated
  using (app.pode_ver_execucao(execution_id))
  with check (app.pode_ver_execucao(execution_id));

notify pgrst, 'reload schema';
