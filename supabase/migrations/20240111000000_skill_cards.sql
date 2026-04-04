-- ─────────────────────────────────────────────────────────────────────────────
-- Sistema de cartas de habilidad
-- ─────────────────────────────────────────────────────────────────────────────

-- Catálogo de cartas
create table public.skill_cards (
  id                 uuid    default gen_random_uuid() primary key,
  name               text    not null,
  description        text,
  category           text    not null, -- strength | agility | intelligence
  rarity             text    not null, -- common | uncommon | rare | epic | legendary
  base_cost          integer not null default 1,  -- puntos de presupuesto en rango 1
  base_mana_fuse     integer not null default 10, -- maná base para fusionar
  attack_bonus       integer default 0 not null,
  defense_bonus      integer default 0 not null,
  hp_bonus           integer default 0 not null,
  strength_bonus     integer default 0 not null,
  agility_bonus      integer default 0 not null,
  intelligence_bonus integer default 0 not null
);

-- Cartas en posesión de cada héroe
create table public.hero_cards (
  id          uuid        default gen_random_uuid() primary key,
  hero_id     uuid        references public.heroes(id) on delete cascade not null,
  card_id     uuid        references public.skill_cards(id) not null,
  rank        integer     default 1 not null,
  equipped    boolean     default false not null,
  obtained_at timestamptz default now() not null
);

-- RLS
alter table public.skill_cards enable row level security;
alter table public.hero_cards  enable row level security;

create policy "skill_cards: public read" on public.skill_cards
  for select using (true);

create policy "hero_cards: own hero" on public.hero_cards
  for all using (
    exists (select 1 from public.heroes where id = hero_id and player_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Biblioteca: nuevo edificio para gestionar cartas
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.buildings (player_id, type, level)
select player_id, 'library', 1
from public.buildings
where type = 'barracks'
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed del catálogo de cartas
-- Efectos base × rango al equipar. Presupuesto = base_cost × rango.
-- ─────────────────────────────────────────────────────────────────────────────

-- FUERZA (guerrero: ataque y defensa física)
insert into public.skill_cards (name, description, category, rarity, base_cost, base_mana_fuse, attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus) values
  ('Golpe Brutal',      'Aumenta la potencia de cada golpe.',                  'strength', 'common',    1,  10,   3, 0,  0, 0, 0, 0),
  ('Piel de Hierro',    'Endurece el cuerpo contra los impactos.',              'strength', 'common',    1,  10,   0, 2, 10, 0, 0, 0),
  ('Furia Guerrera',    'La ira amplifica la fuerza en combate.',               'strength', 'uncommon',  2,  25,   5, 0,  0, 1, 0, 0),
  ('Escudo Viviente',   'El cuerpo se convierte en un muro infranqueable.',     'strength', 'uncommon',  2,  25,   0, 4, 15, 0, 0, 0),
  ('Maestría Marcial',  'Dominio completo de las técnicas de combate cuerpo a cuerpo.', 'strength', 'rare', 3, 60, 7, 3, 0, 0, 0, 0),
  ('Resistencia Titánica', 'Vitalidad sobrehumana que desafía la muerte.',      'strength', 'epic',      4, 120,  0, 6, 50, 0, 0, 0),
  ('Campeón Eterno',    'La encarnación del guerrero perfecto.',                'strength', 'legendary', 5, 200, 12, 6, 30, 0, 0, 0);

-- AGILIDAD (pícaro: velocidad y precisión)
insert into public.skill_cards (name, description, category, rarity, base_cost, base_mana_fuse, attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus) values
  ('Paso Ligero',       'Movimientos fluidos que engañan al enemigo.',          'agility', 'common',    1,  10,   0, 0,  0, 0, 2, 0),
  ('Golpe Rápido',      'Un ataque veloz que el rival no puede bloquear.',      'agility', 'common',    1,  10,   2, 0,  0, 0, 1, 0),
  ('Esquiva Experta',   'Anticipar el peligro antes de que llegue.',            'agility', 'uncommon',  2,  25,   0, 2,  0, 0, 3, 0),
  ('Acero Veloz',       'La velocidad se convierte en filo mortal.',            'agility', 'uncommon',  2,  25,   4, 0,  0, 0, 2, 0),
  ('Danza de Cuchillas','Un torbellino de ataques imposibles de seguir.',       'agility', 'rare',      3,  60,   6, 0,  0, 0, 4, 0),
  ('Sombra Veloz',      'Moverse entre las sombras, invisible al peligro.',     'agility', 'epic',      4, 120,   5, 2,  0, 0, 7, 0),
  ('Espectro',          'Ni visto ni sentido hasta que es demasiado tarde.',    'agility', 'legendary', 5, 200,   8, 0, 20, 0,10, 0);

-- INTELIGENCIA (mago: magia defensiva y poder arcano)
insert into public.skill_cards (name, description, category, rarity, base_cost, base_mana_fuse, attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus) values
  ('Mente Clara',       'La claridad mental agudiza todos los sentidos.',       'intelligence', 'common',    1,  10,   0, 0,  0, 0, 0, 2),
  ('Escudo Arcano',     'Una barrera mágica absorbe el daño recibido.',         'intelligence', 'common',    1,  10,   0, 3,  0, 0, 0, 0),
  ('Canalización',      'Canaliza el flujo arcano hacia el cuerpo.',            'intelligence', 'uncommon',  2,  25,   0, 0, 15, 0, 0, 3),
  ('Barrera Mística',   'Un campo de fuerza que desvía los ataques.',           'intelligence', 'uncommon',  2,  25,   0, 4, 20, 0, 0, 0),
  ('Tormenta Mental',   'La mente se convierte en un arma devastadora.',        'intelligence', 'rare',      3,  60,   4, 0,  0, 0, 0, 5),
  ('Fortaleza Arcana',  'Fusiona magia y carne en una armadura viviente.',      'intelligence', 'epic',      4, 120,   0, 5, 35, 0, 0, 6),
  ('Ascensión',         'La consciencia trasciende los límites mortales.',      'intelligence', 'legendary', 5, 200,   0, 6, 50, 0, 0,10);
