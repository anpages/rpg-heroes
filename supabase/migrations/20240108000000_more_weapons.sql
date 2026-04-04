-- ─────────────────────────────────────────────────────────────────────────────
-- Nuevos tipos de armas: mazos (1H), lanzas, arcos y gran mazo (2H)
-- Misma fórmula: base_stat × tier × rarity_mult
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Armas 1H nuevas (mazos) ──────────────────────────────────────────────────
insert into public.item_catalog
  (name, slot, tier, rarity, is_two_handed,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
select
  base.name, base.slot, base.tier, r.rarity, false,
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
from (values
  --  nombre               slot          tier atk def hp str agi int
  ('Mazo de Hueso',       'main_hand',    1,   4,  0,  5,  3,  0,  0),
  ('Mazo de Hierro',      'main_hand',    2,   4,  0,  5,  3,  0,  0),
  ('Mazo de Guerra',      'main_hand',    3,   4,  0,  5,  3,  0,  0)
) as base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
cross join (values
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) as r(rarity, mult, max_dur);

-- ── Armas 2H nuevas (lanzas, arcos, gran mazo) ───────────────────────────────
insert into public.item_catalog
  (name, slot, tier, rarity, is_two_handed,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
select
  base.name, base.slot, base.tier, r.rarity, true,
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
from (values
  --  nombre                  slot          tier atk def hp str agi int
  -- Lanzas: alcance, ataque alto + agilidad
  ('Lanza de Madera',        'main_hand',    1,   7,  0,  0,  0,  2,  0),
  ('Lanza de Hierro',        'main_hand',    2,   7,  0,  0,  0,  2,  0),
  ('Lanza de Acero',         'main_hand',    3,   7,  0,  0,  0,  2,  0),
  -- Arcos: alta agilidad, ataque medio
  ('Arco Corto',             'main_hand',    1,   5,  0,  0,  0,  5,  0),
  ('Arco de Caza',           'main_hand',    2,   5,  0,  0,  0,  5,  0),
  ('Arco Largo',             'main_hand',    3,   5,  0,  0,  0,  5,  0),
  -- Gran Mazo: fuerza brutal, algo de HP
  ('Gran Mazo de Hierro',    'main_hand',    2,   6,  0,  4,  5,  0,  0),
  ('Gran Mazo de Acero',     'main_hand',    3,   6,  0,  4,  5,  0,  0)
) as base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
cross join (values
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) as r(rarity, mult, max_dur);
