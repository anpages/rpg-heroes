-- ─────────────────────────────────────────────────────────────────────────────
-- Armas específicas por clase: caudillo, arcanista, sombra, domador
-- Añade required_class a item_catalog + armas exclusivas por clase
-- Fórmula: base_stat × tier × rarity_mult (igual que armas universales)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Columna de restricción de clase ─────────────────────────────────────────
ALTER TABLE public.item_catalog
  ADD COLUMN IF NOT EXISTS required_class text
  REFERENCES public.classes(id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CAUDILLO — Guerrero: ATQ+STR altos, peso alto, algo de HP/DEF
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Caudillo: Armas 1H ──────────────────────────────────────────────────────
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
  -- Hachas: ATQ alto + STR
  ('Hacha de Piedra',          'main_hand', 1,  6, 0, 0, 3, 0, 0),
  ('Hacha de Hierro',          'main_hand', 2,  6, 0, 0, 3, 0, 0),
  ('Hacha de Acero',           'main_hand', 3,  6, 0, 0, 3, 0, 0),
  -- Espada Ancha: ATQ + algo de DEF y HP
  ('Espada Ancha de Bronce',   'main_hand', 1,  5, 1, 5, 2, 0, 0),
  ('Espada Ancha de Hierro',   'main_hand', 2,  5, 1, 5, 2, 0, 0),
  ('Espada Ancha de Acero',    'main_hand', 3,  5, 1, 5, 2, 0, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Caudillo: Armas 2H ──────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, true, 'caudillo',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  -- Espadón: ATQ muy alto + STR + HP
  ('Espadón de Hierro',        'main_hand', 2,  9, 0, 5, 4, 0, 0),
  ('Espadón de Acero',         'main_hand', 3,  9, 0, 5, 4, 0, 0),
  -- Hacha Doble: STR muy alta + ATQ
  ('Hacha Doble de Hueso',     'main_hand', 1,  8, 0, 3, 5, 0, 0),
  ('Hacha Doble de Hierro',    'main_hand', 2,  8, 0, 3, 5, 0, 0),
  ('Hacha Doble de Acero',     'main_hand', 3,  8, 0, 3, 5, 0, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Caudillo: Off-hand (Escudo Torre) ───────────────────────────────────────
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
  ('Escudo Torre de Madera',   'off_hand',  1,  0, 4, 8, 1, 0, 0),
  ('Escudo Torre de Hierro',   'off_hand',  2,  0, 4, 8, 1, 0, 0),
  ('Escudo Torre de Acero',    'off_hand',  3,  0, 4, 8, 1, 0, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ARCANISTA — Mago: INT+ATQ, peso mínimo, frágil
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Arcanista: Armas 1H ─────────────────────────────────────────────────────
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
  -- Varita: INT alto
  ('Varita de Sauce',          'main_hand', 1,  4, 0, 0, 0, 0, 5),
  ('Varita de Cristal',        'main_hand', 2,  4, 0, 0, 0, 0, 5),
  ('Varita Arcana',            'main_hand', 3,  4, 0, 0, 0, 0, 5),
  -- Daga Ritual: ATQ + INT
  ('Daga Ritual de Hueso',     'main_hand', 1,  5, 0, 0, 0, 1, 3),
  ('Daga Ritual de Plata',     'main_hand', 2,  5, 0, 0, 0, 1, 3),
  ('Daga Ritual de Mithril',   'main_hand', 3,  5, 0, 0, 0, 1, 3)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Arcanista: Armas 2H ─────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, true, 'arcanista',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  -- Bastón: ATQ + INT alto
  ('Bastón de Roble',          'main_hand', 1,  7, 0, 0, 0, 0, 7),
  ('Bastón de Hierro',         'main_hand', 2,  7, 0, 0, 0, 0, 7),
  ('Bastón Arcano',            'main_hand', 3,  7, 0, 0, 0, 0, 7),
  -- Grimorio: INT máximo + algo de DEF
  ('Grimorio Básico',          'main_hand', 1,  6, 1, 0, 0, 0, 8),
  ('Grimorio Avanzado',        'main_hand', 2,  6, 1, 0, 0, 0, 8),
  ('Grimorio Supremo',         'main_hand', 3,  6, 1, 0, 0, 0, 8)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Arcanista: Off-hand (Orbe) ──────────────────────────────────────────────
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
  ('Orbe de Cuarzo',           'off_hand',  1,  2, 0, 0, 0, 0, 4),
  ('Orbe de Amatista',         'off_hand',  2,  2, 0, 0, 0, 0, 4),
  ('Orbe de Obsidiana',        'off_hand',  3,  2, 0, 0, 0, 0, 4)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SOMBRA — Rogue: AGI+ATQ altos, peso mínimo, sin DEF/HP
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Sombra: Armas 1H ────────────────────────────────────────────────────────
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
  -- Daga: ATQ + AGI alta
  ('Daga de Cobre',            'main_hand', 1,  5, 0, 0, 0, 4, 0),
  ('Daga de Hierro',           'main_hand', 2,  5, 0, 0, 0, 4, 0),
  ('Daga de Acero',            'main_hand', 3,  5, 0, 0, 0, 4, 0),
  -- Estoque: ATQ alto + AGI
  ('Estoque de Bronce',        'main_hand', 1,  6, 0, 0, 0, 3, 0),
  ('Estoque de Hierro',        'main_hand', 2,  6, 0, 0, 0, 3, 0),
  ('Estoque de Acero',         'main_hand', 3,  6, 0, 0, 0, 3, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Sombra: Armas 2H ────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, true, 'sombra',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  -- Garras: ATQ alto + AGI alta
  ('Garras de Hueso',          'main_hand', 1,  9, 0, 0, 0, 5, 0),
  ('Garras de Hierro',         'main_hand', 2,  9, 0, 0, 0, 5, 0),
  ('Garras de Acero',          'main_hand', 3,  9, 0, 0, 0, 5, 0),
  -- Ballesta: ATQ + algo de AGI y STR
  ('Ballesta Ligera',          'main_hand', 1,  8, 0, 0, 1, 4, 0),
  ('Ballesta de Precisión',    'main_hand', 2,  8, 0, 0, 1, 4, 0),
  ('Ballesta Pesada',          'main_hand', 3,  8, 0, 0, 1, 4, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Sombra: Off-hand (Cuchillos Arrojadizos) ────────────────────────────────
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
  ('Cuchillos de Hueso',       'off_hand',  1,  3, 0, 0, 0, 2, 0),
  ('Cuchillos de Hierro',      'off_hand',  2,  3, 0, 0, 0, 2, 0),
  ('Cuchillos de Acero',       'off_hand',  3,  3, 0, 0, 0, 2, 0)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOMADOR — Equilibrado: STR+AGI+INT repartidos, peso medio
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Domador: Armas 1H ───────────────────────────────────────────────────────
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
  -- Látigo: ATQ + stats equilibrados
  ('Látigo de Cuero',          'main_hand', 1,  4, 0, 0, 2, 2, 2),
  ('Látigo Trenzado',          'main_hand', 2,  4, 0, 0, 2, 2, 2),
  ('Látigo de Cadenas',        'main_hand', 3,  4, 0, 0, 2, 2, 2),
  -- Cayado: DEF + HP + stats
  ('Cayado de Rama',           'main_hand', 1,  3, 1, 5, 1, 1, 2),
  ('Cayado de Roble',          'main_hand', 2,  3, 1, 5, 1, 1, 2),
  ('Cayado de Espinas',        'main_hand', 3,  3, 1, 5, 1, 1, 2)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Domador: Armas 2H ───────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, true, 'domador',
  greatest(0, round(base.atk   * base.tier * r.mult)::int),
  greatest(0, round(base.def   * base.tier * r.mult)::int),
  greatest(0, round(base.hp    * base.tier * r.mult)::int),
  greatest(0, round(base.str_b * base.tier * r.mult)::int),
  greatest(0, round(base.agi   * base.tier * r.mult)::int),
  greatest(0, round(base.int_b * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  -- Lanza Bestial: ATQ + HP + stats equilibrados
  ('Lanza Bestial de Hueso',   'main_hand', 1,  7, 0, 3, 3, 2, 2),
  ('Lanza Bestial de Hierro',  'main_hand', 2,  7, 0, 3, 3, 2, 2),
  ('Lanza Bestial de Acero',   'main_hand', 3,  7, 0, 3, 3, 2, 2),
  -- Arco Salvaje: ATQ medio + stats repartidos
  ('Arco Salvaje Corto',       'main_hand', 1,  6, 0, 0, 2, 3, 3),
  ('Arco Salvaje de Cuerno',   'main_hand', 2,  6, 0, 0, 2, 3, 3),
  ('Arco Salvaje Largo',       'main_hand', 3,  6, 0, 0, 2, 3, 3)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Domador: Off-hand (Talismán Bestial) ────────────────────────────────────
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
  ('Talismán de Colmillo',     'off_hand',  1,  0, 1, 5, 1, 1, 2),
  ('Talismán de Garra',        'off_hand',  2,  0, 1, 5, 1, 1, 2),
  ('Talismán de Escama',       'off_hand',  3,  0, 1, 5, 1, 1, 2)
) AS base(name, slot, tier, atk, def, hp, str_b, agi, int_b)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);
