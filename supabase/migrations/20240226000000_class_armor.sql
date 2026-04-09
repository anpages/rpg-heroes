-- ─────────────────────────────────────────────────────────────────────────────
-- Armaduras específicas por clase: caudillo, arcanista, sombra, domador
-- Slots: helmet, chest, arms, legs, accessory (5 slots × 4 clases × 3 tiers × 5 rarezas = 300 ítems)
-- Fórmula: base_stat × tier × rarity_mult
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════════
-- CAUDILLO — Armadura pesada: DEF alto, HP, FUE
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Caudillo: Casco ─────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'caudillo',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Yelmo de Bronce',            'helmet', 1,  0, 3, 12, 1, 0, 0),
  ('Yelmo de Hierro',            'helmet', 2,  0, 3, 12, 1, 0, 0),
  ('Yelmo de Acero Templado',    'helmet', 3,  0, 3, 12, 1, 0, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Caudillo: Pecho ─────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'caudillo',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Coraza de Bronce',           'chest', 1,  0, 5, 25, 2, 0, 0),
  ('Coraza de Hierro',           'chest', 2,  0, 5, 25, 2, 0, 0),
  ('Coraza de Acero Templado',   'chest', 3,  0, 5, 25, 2, 0, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Caudillo: Brazos ────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'caudillo',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Manoplas de Bronce',         'arms', 1,  0, 2, 0, 2, 0, 0),
  ('Manoplas de Hierro',         'arms', 2,  0, 2, 0, 2, 0, 0),
  ('Manoplas de Acero Templado', 'arms', 3,  0, 2, 0, 2, 0, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Caudillo: Piernas ───────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'caudillo',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Grebas de Bronce',           'legs', 1,  0, 3, 0, 1, 0, 0),
  ('Grebas de Hierro Pesado',    'legs', 2,  0, 3, 0, 1, 0, 0),
  ('Grebas de Acero Templado',   'legs', 3,  0, 3, 0, 1, 0, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Caudillo: Accesorio ─────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'caudillo',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Colgante de Guerrero',       'accessory', 1,  0, 0, 10, 3, 0, 0),
  ('Medalla de Batalla',         'accessory', 2,  0, 0, 10, 3, 0, 0),
  ('Insignia del Campeón',       'accessory', 3,  0, 0, 10, 3, 0, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ARCANISTA — Túnicas y telas mágicas: INT alto, HP moderado, DEF bajo
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Arcanista: Casco ────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'arcanista',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Capirote de Lino',           'helmet', 1,  0, 1, 8, 0, 0, 3),
  ('Capirote de Seda',           'helmet', 2,  0, 1, 8, 0, 0, 3),
  ('Capirote Arcano',            'helmet', 3,  0, 1, 8, 0, 0, 3)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Arcanista: Pecho ────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'arcanista',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Túnica de Lino',             'chest', 1,  0, 2, 15, 0, 0, 4),
  ('Túnica de Seda',             'chest', 2,  0, 2, 15, 0, 0, 4),
  ('Túnica Arcana',              'chest', 3,  0, 2, 15, 0, 0, 4)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Arcanista: Brazos ───────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'arcanista',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Guantes de Tela',            'arms', 1,  0, 1, 0, 0, 0, 2),
  ('Guantes de Seda',            'arms', 2,  0, 1, 0, 0, 0, 2),
  ('Guantes Arcanos',            'arms', 3,  0, 1, 0, 0, 0, 2)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Arcanista: Piernas ──────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'arcanista',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Faldón de Lino',             'legs', 1,  0, 1, 0, 0, 1, 2),
  ('Faldón de Seda',             'legs', 2,  0, 1, 0, 0, 1, 2),
  ('Faldón Arcano',              'legs', 3,  0, 1, 0, 0, 1, 2)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Arcanista: Accesorio ────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'arcanista',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Anillo de Aprendiz',         'accessory', 1,  0, 0, 5, 0, 0, 4),
  ('Anillo de Hechicero',        'accessory', 2,  0, 0, 5, 0, 0, 4),
  ('Anillo del Archimago',       'accessory', 3,  0, 0, 5, 0, 0, 4)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SOMBRA — Cuero ligero: AGI alto, ATQ, DEF medio
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Sombra: Casco ───────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'sombra',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Máscara de Cuero',           'helmet', 1,  0, 1, 0, 0, 3, 0),
  ('Máscara de Cuero Curtido',   'helmet', 2,  0, 1, 0, 0, 3, 0),
  ('Máscara de Ébano',           'helmet', 3,  0, 1, 0, 0, 3, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Sombra: Pecho ───────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'sombra',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Chaleco de Cuero',           'chest', 1,  0, 3, 0, 0, 4, 0),
  ('Chaleco de Cuero Curtido',   'chest', 2,  0, 3, 0, 0, 4, 0),
  ('Chaleco de Ébano',           'chest', 3,  0, 3, 0, 0, 4, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Sombra: Brazos ──────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'sombra',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Brazales de Cuero',          'arms', 1,  2, 0, 0, 0, 1, 0),
  ('Brazales de Cuero Curtido',  'arms', 2,  2, 0, 0, 0, 1, 0),
  ('Brazales de Ébano',          'arms', 3,  2, 0, 0, 0, 1, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Sombra: Piernas ─────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'sombra',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Pantalón de Cuero',          'legs', 1,  0, 1, 0, 0, 3, 0),
  ('Pantalón de Cuero Curtido',  'legs', 2,  0, 1, 0, 0, 3, 0),
  ('Pantalón de Ébano',          'legs', 3,  0, 1, 0, 0, 3, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Sombra: Accesorio ───────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'sombra',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Pendiente de Sombra',        'accessory', 1,  1, 0, 0, 0, 3, 0),
  ('Pendiente de Noche',         'accessory', 2,  1, 0, 0, 0, 3, 0),
  ('Pendiente del Vacío',        'accessory', 3,  1, 0, 0, 0, 3, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOMADOR — Pieles y naturaleza: equilibrado FUE+AGI+INT
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Domador: Casco ──────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'domador',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Casco de Piel',              'helmet', 1,  0, 2, 0, 1, 1, 1),
  ('Casco de Piel Curtida',      'helmet', 2,  0, 2, 0, 1, 1, 1),
  ('Casco de Escamas',           'helmet', 3,  0, 2, 0, 1, 1, 1)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Domador: Pecho ──────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'domador',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Pechera de Piel',            'chest', 1,  0, 3, 10, 2, 1, 1),
  ('Pechera de Piel Curtida',    'chest', 2,  0, 3, 10, 2, 1, 1),
  ('Pechera de Escamas',         'chest', 3,  0, 3, 10, 2, 1, 1)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Domador: Brazos ─────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'domador',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Guanteletes de Piel',        'arms', 1,  0, 1, 0, 1, 1, 1),
  ('Guanteletes de Piel Curtida','arms', 2,  0, 1, 0, 1, 1, 1),
  ('Guanteletes de Escamas',     'arms', 3,  0, 1, 0, 1, 1, 1)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Domador: Piernas ────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'domador',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Polainas de Piel',           'legs', 1,  0, 2, 0, 1, 1, 1),
  ('Polainas de Piel Curtida',   'legs', 2,  0, 2, 0, 1, 1, 1),
  ('Polainas de Escamas',        'legs', 3,  0, 2, 0, 1, 1, 1)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Domador: Accesorio ──────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'domador',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Colmillo de Bestia',         'accessory', 1,  0, 0, 5, 1, 1, 2),
  ('Garra de Bestia',            'accessory', 2,  0, 0, 5, 1, 1, 2),
  ('Escama de Dragón',           'accessory', 3,  0, 0, 5, 1, 1, 2)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);
