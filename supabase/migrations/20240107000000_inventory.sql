-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo global de items
-- ─────────────────────────────────────────────────────────────────────────────
create table public.item_catalog (
  id                 uuid    default gen_random_uuid() primary key,
  name               text    not null,
  slot               text    not null, -- helmet|chest|arms|legs|feet|main_hand|off_hand|accessory
  tier               integer not null,
  rarity             text    not null, -- common|uncommon|rare|epic|legendary
  is_two_handed      boolean default false not null,
  attack_bonus       integer default 0 not null,
  defense_bonus      integer default 0 not null,
  hp_bonus           integer default 0 not null,
  strength_bonus     integer default 0 not null,
  agility_bonus      integer default 0 not null,
  intelligence_bonus integer default 0 not null,
  max_durability     integer not null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Items en posesión de cada héroe
-- ─────────────────────────────────────────────────────────────────────────────
create table public.inventory_items (
  id                 uuid      default gen_random_uuid() primary key,
  hero_id            uuid      references public.heroes(id) on delete cascade not null,
  catalog_id         uuid      references public.item_catalog(id) not null,
  current_durability integer   not null,
  equipped_slot      text      default null, -- null = en mochila
  obtained_at        timestamptz default now() not null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.item_catalog enable row level security;
alter table public.inventory_items enable row level security;

create policy "item_catalog: public read" on public.item_catalog
  for select using (true);

create policy "inventory_items: own hero" on public.inventory_items
  for all using (
    exists (select 1 from public.heroes where id = hero_id and player_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Función para reducir durabilidad del equipo equipado
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function reduce_equipment_durability(p_hero_id uuid, amount integer)
returns void language sql security definer as $$
  update public.inventory_items
  set current_durability = greatest(0, current_durability - amount)
  where hero_id = p_hero_id and equipped_slot is not null;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed del catálogo — armas y armaduras tier 1-3 × 5 rarezas
-- Fórmula stats: base_stat × tier × rarity_mult
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.item_catalog
  (name, slot, tier, rarity, is_two_handed,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
select
  base.name, base.slot, base.tier, r.rarity, false,
  greatest(0, round(base.atk  * base.tier * r.mult)::int),
  greatest(0, round(base.def  * base.tier * r.mult)::int),
  greatest(0, round(base.hp   * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi  * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
from (values
  --  nombre                      slot         tier atk def  hp str agi int
  ('Capucha de Cuero',           'helmet',       1,  0,  2, 10,  0,  0,  0),
  ('Casco de Hierro',            'helmet',       2,  0,  2, 10,  0,  0,  0),
  ('Yelmo de Acero',             'helmet',       3,  0,  2, 10,  0,  0,  0),
  ('Peto de Cuero',              'chest',        1,  0,  4, 20,  0,  0,  0),
  ('Peto de Hierro',             'chest',        2,  0,  4, 20,  0,  0,  0),
  ('Armadura de Acero',          'chest',        3,  0,  4, 20,  0,  0,  0),
  ('Guantes de Cuero',           'arms',         1,  1,  1,  0,  0,  0,  0),
  ('Guanteletes de Hierro',      'arms',         2,  1,  1,  0,  0,  0,  0),
  ('Guanteletes de Acero',       'arms',         3,  1,  1,  0,  0,  0,  0),
  ('Grebas de Cuero',            'legs',         1,  0,  2,  0,  0,  1,  0),
  ('Grebas de Hierro',           'legs',         2,  0,  2,  0,  0,  1,  0),
  ('Grebas de Acero',            'legs',         3,  0,  2,  0,  0,  1,  0),
  ('Botas de Cuero',             'feet',         1,  0,  0,  0,  0,  2,  0),
  ('Botas de Hierro',            'feet',         2,  0,  0,  0,  0,  2,  0),
  ('Botas de Acero',             'feet',         3,  0,  0,  0,  0,  2,  0),
  ('Espada Corta',               'main_hand',    1,  5,  0,  0,  0,  0,  0),
  ('Espada de Hierro',           'main_hand',    2,  5,  0,  0,  0,  0,  0),
  ('Espada de Acero',            'main_hand',    3,  5,  0,  0,  0,  0,  0),
  ('Escudo de Madera',           'off_hand',     1,  0,  3,  0,  0,  0,  0),
  ('Escudo de Hierro',           'off_hand',     2,  0,  3,  0,  0,  0,  0),
  ('Escudo de Acero',            'off_hand',     3,  0,  3,  0,  0,  0,  0),
  ('Anillo de Cobre',            'accessory',    1,  0,  0,  0,  1,  0,  2),
  ('Anillo de Plata',            'accessory',    2,  0,  0,  0,  1,  0,  2),
  ('Amuleto Arcano',             'accessory',    3,  0,  0,  0,  1,  0,  2)
) as base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
cross join (values
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) as r(rarity, mult, max_dur);

-- Armas a dos manos (base_atk ×1.6 respecto a 1H, ocupa ambas manos)
insert into public.item_catalog
  (name, slot, tier, rarity, is_two_handed,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
values
  ('Gran Espada de Hierro', 'main_hand', 2, 'common',    true, 16, 0,0,0,0,0, 50),
  ('Gran Espada de Hierro', 'main_hand', 2, 'uncommon',  true, 20, 0,0,0,0,0, 65),
  ('Gran Espada de Hierro', 'main_hand', 2, 'rare',      true, 24, 0,0,0,0,0, 80),
  ('Gran Espada de Hierro', 'main_hand', 2, 'epic',      true, 29, 0,0,0,0,0, 100),
  ('Gran Espada de Hierro', 'main_hand', 2, 'legendary', true, 40, 0,0,0,0,0, 120),
  ('Gran Espada de Acero',  'main_hand', 3, 'common',    true, 24, 0,0,0,0,0, 50),
  ('Gran Espada de Acero',  'main_hand', 3, 'uncommon',  true, 29, 0,0,0,0,0, 65),
  ('Gran Espada de Acero',  'main_hand', 3, 'rare',      true, 36, 0,0,0,0,0, 80),
  ('Gran Espada de Acero',  'main_hand', 3, 'epic',      true, 43, 0,0,0,0,0, 100),
  ('Gran Espada de Acero',  'main_hand', 3, 'legendary', true, 60, 0,0,0,0,0, 120);
