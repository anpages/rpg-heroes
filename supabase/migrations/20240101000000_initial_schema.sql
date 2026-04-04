-- Players table (extends auth.users)
create table public.players (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  created_at timestamptz default now()
);

-- Resources per player
create table public.resources (
  player_id uuid references public.players(id) on delete cascade primary key,
  gold bigint default 500 not null,
  wood bigint default 300 not null,
  mana bigint default 100 not null,
  gold_rate integer default 10 not null,  -- per minute
  wood_rate integer default 6 not null,
  mana_rate integer default 2 not null,
  last_collected_at timestamptz default now()
);

-- Buildings at the player's base
create table public.buildings (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.players(id) on delete cascade,
  type text not null, -- 'gold_mine' | 'lumber_mill' | 'mana_well' | 'barracks' | 'workshop'
  level integer default 1 not null,
  upgrade_started_at timestamptz,
  upgrade_ends_at timestamptz,
  created_at timestamptz default now(),
  unique(player_id, type)
);

-- Hero (one per player)
create table public.heroes (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.players(id) on delete cascade unique,
  name text not null,
  level integer default 1 not null,
  experience integer default 0 not null,
  -- Base stats
  strength integer default 10 not null,
  agility integer default 10 not null,
  intelligence integer default 10 not null,
  -- Derived stats (calculated)
  max_hp integer default 100 not null,
  current_hp integer default 100 not null,
  attack integer default 10 not null,
  defense integer default 5 not null,
  -- State
  status text default 'idle' not null, -- 'idle' | 'exploring' | 'resting'
  created_at timestamptz default now()
);

-- Hero abilities
create table public.hero_abilities (
  id uuid default gen_random_uuid() primary key,
  hero_id uuid references public.heroes(id) on delete cascade,
  type text not null, -- 'slash' | 'fireball' | 'heal' | 'shield' | 'arrow_rain'
  level integer default 1 not null,
  unlocked_at timestamptz default now(),
  unique(hero_id, type)
);

-- Dungeons (global, not per player)
create table public.dungeons (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  difficulty integer not null, -- 1-10
  min_hero_level integer default 1,
  duration_minutes integer not null, -- travel + fight time
  -- Rewards range
  gold_min integer default 0,
  gold_max integer default 0,
  wood_min integer default 0,
  wood_max integer default 0,
  mana_min integer default 0,
  mana_max integer default 0,
  experience_reward integer not null
);

-- Hero expeditions to dungeons
create table public.expeditions (
  id uuid default gen_random_uuid() primary key,
  hero_id uuid references public.heroes(id) on delete cascade,
  dungeon_id uuid references public.dungeons(id),
  started_at timestamptz default now(),
  ends_at timestamptz not null,
  status text default 'traveling' not null, -- 'traveling' | 'completed' | 'failed'
  -- Filled on completion
  gold_earned integer,
  wood_earned integer,
  mana_earned integer,
  experience_earned integer,
  battle_log jsonb,
  completed_at timestamptz
);

-- PvP battles
create table public.battles (
  id uuid default gen_random_uuid() primary key,
  attacker_id uuid references public.players(id),
  defender_id uuid references public.players(id),
  winner_id uuid references public.players(id),
  battle_log jsonb not null,
  gold_stolen integer default 0,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.players enable row level security;
alter table public.resources enable row level security;
alter table public.buildings enable row level security;
alter table public.heroes enable row level security;
alter table public.hero_abilities enable row level security;
alter table public.expeditions enable row level security;
alter table public.battles enable row level security;
alter table public.dungeons enable row level security;

-- Policies: players can read/write their own data
create policy "players: own data" on public.players for all using (auth.uid() = id);
create policy "resources: own data" on public.resources for all using (auth.uid() = player_id);
create policy "buildings: own data" on public.buildings for all using (auth.uid() = player_id);
create policy "heroes: own data" on public.heroes for all using (auth.uid() = player_id);
create policy "hero_abilities: own data" on public.hero_abilities for all using (
  exists (select 1 from public.heroes where id = hero_id and player_id = auth.uid())
);
create policy "expeditions: own data" on public.expeditions for all using (
  exists (select 1 from public.heroes where id = hero_id and player_id = auth.uid())
);
-- Battles: visible to attacker and defender
create policy "battles: participants" on public.battles for select using (
  auth.uid() = attacker_id or auth.uid() = defender_id
);
-- Dungeons: public read
create policy "dungeons: public read" on public.dungeons for select using (true);

-- Seed initial dungeons
insert into public.dungeons (name, description, difficulty, min_hero_level, duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward) values
  ('Goblin Cave', 'A small cave infested with goblins. Easy pickings for a new hero.', 1, 1, 5, 20, 50, 10, 30, 0, 5, 25),
  ('Dark Forest', 'Ancient trees hide dangerous beasts. Bring enough potions.', 3, 3, 10, 50, 120, 40, 80, 10, 25, 60),
  ('Haunted Ruins', 'Old fortress ruins haunted by undead. Mana flows freely here.', 5, 5, 20, 80, 200, 20, 60, 30, 80, 120),
  ('Dragon''s Lair', 'Few who enter return. The rewards are legendary.', 9, 10, 45, 300, 800, 100, 300, 100, 300, 400);
