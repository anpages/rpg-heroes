-- Tabla para almacenar combates de práctica (combate rápido / entrenamiento)
create table if not exists training_combats (
  id             uuid primary key default gen_random_uuid(),
  hero_id        uuid not null references heroes(id) on delete cascade,
  won            boolean not null,
  rounds         integer not null,
  log            jsonb not null default '[]',
  hero_name      text,
  enemy_name     text,
  hero_max_hp    integer,
  enemy_max_hp   integer,
  gold_reward    integer not null default 0,
  xp_reward      integer not null default 0,
  created_at     timestamptz not null default now()
);

create index idx_training_combats_hero on training_combats(hero_id, created_at desc);

-- RLS
alter table training_combats enable row level security;

create policy "Players can view own training combats"
  on training_combats for select
  using (hero_id in (select id from heroes where player_id = auth.uid()));

create policy "Server can insert training combats"
  on training_combats for insert
  with check (true);
