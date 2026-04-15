-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4: Items universales + limpieza de items genéricos
-- Los items genéricos (required_class IS NULL) no tienen clase y dan stats
-- de todo tipo, lo que no encaja con el sistema de clases. Se eliminan y se
-- sustituyen por items de clase Universal que dan stats equilibradas.
--
-- Fórmula idéntica a items de clase: base_stat × tier × rarity_mult
-- Raridad: common=1.0 uncommon=1.2 rare=1.5 epic=1.8 legendary=2.5
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Limpiar items genéricos del inventario ───────────────────────────────────
DELETE FROM public.inventory_items
WHERE catalog_id IN (
  SELECT id FROM public.item_catalog WHERE required_class IS NULL
);

-- ── Eliminar items genéricos del catálogo ────────────────────────────────────
DELETE FROM public.item_catalog WHERE required_class IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- UNIVERSAL — Stats equilibradas: atk, def, hp, str, agi, int
-- Ningún stat dominante, útiles para cualquier build
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Casco ────────────────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'universal',
  greatest(0, round(base.atk * base.tier * r.mult)::int),
  greatest(0, round(base.def * base.tier * r.mult)::int),
  greatest(0, round(base.hp  * base.tier * r.mult)::int),
  greatest(0, round(base.str * base.tier * r.mult)::int),
  greatest(0, round(base.agi * base.tier * r.mult)::int),
  greatest(0, round(base.int * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Yelmo del Pactante',  'helmet', 1, 0, 2, 5, 1, 1, 2),
  ('Yelmo Ancestral',     'helmet', 2, 0, 2, 5, 1, 1, 2),
  ('Yelmo Primordial',    'helmet', 3, 0, 2, 5, 1, 1, 2)
) AS base(name, slot, tier, atk, def, hp, str, agi, int)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Pecho ─────────────────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'universal',
  greatest(0, round(base.atk * base.tier * r.mult)::int),
  greatest(0, round(base.def * base.tier * r.mult)::int),
  greatest(0, round(base.hp  * base.tier * r.mult)::int),
  greatest(0, round(base.str * base.tier * r.mult)::int),
  greatest(0, round(base.agi * base.tier * r.mult)::int),
  greatest(0, round(base.int * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Coraza del Equilibrio', 'chest', 1, 0, 3, 6, 1, 1, 1),
  ('Coraza Ancestral',      'chest', 2, 0, 3, 6, 1, 1, 1),
  ('Coraza Primordial',     'chest', 3, 0, 3, 6, 1, 1, 1)
) AS base(name, slot, tier, atk, def, hp, str, agi, int)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Brazos ────────────────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'universal',
  greatest(0, round(base.atk * base.tier * r.mult)::int),
  greatest(0, round(base.def * base.tier * r.mult)::int),
  greatest(0, round(base.hp  * base.tier * r.mult)::int),
  greatest(0, round(base.str * base.tier * r.mult)::int),
  greatest(0, round(base.agi * base.tier * r.mult)::int),
  greatest(0, round(base.int * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Guanteletes del Pactante',   'arms', 1, 1, 2, 4, 1, 2, 1),
  ('Guanteletes Ancestrales',    'arms', 2, 1, 2, 4, 1, 2, 1),
  ('Guanteletes Primordiales',   'arms', 3, 1, 2, 4, 1, 2, 1)
) AS base(name, slot, tier, atk, def, hp, str, agi, int)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Piernas ───────────────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'universal',
  greatest(0, round(base.atk * base.tier * r.mult)::int),
  greatest(0, round(base.def * base.tier * r.mult)::int),
  greatest(0, round(base.hp  * base.tier * r.mult)::int),
  greatest(0, round(base.str * base.tier * r.mult)::int),
  greatest(0, round(base.agi * base.tier * r.mult)::int),
  greatest(0, round(base.int * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Grebas del Equilibrio', 'legs', 1, 0, 2, 5, 1, 2, 1),
  ('Grebas Ancestrales',    'legs', 2, 0, 2, 5, 1, 2, 1),
  ('Grebas Primordiales',   'legs', 3, 0, 2, 5, 1, 2, 1)
) AS base(name, slot, tier, atk, def, hp, str, agi, int)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Arma 1H ───────────────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'universal',
  greatest(0, round(base.atk * base.tier * r.mult)::int),
  greatest(0, round(base.def * base.tier * r.mult)::int),
  greatest(0, round(base.hp  * base.tier * r.mult)::int),
  greatest(0, round(base.str * base.tier * r.mult)::int),
  greatest(0, round(base.agi * base.tier * r.mult)::int),
  greatest(0, round(base.int * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Espada del Equilibrio', 'main_hand', 1, 3, 0, 4, 1, 1, 1),
  ('Espada Ancestral',      'main_hand', 2, 3, 0, 4, 1, 1, 1),
  ('Espada Primordial',     'main_hand', 3, 3, 0, 4, 1, 1, 1)
) AS base(name, slot, tier, atk, def, hp, str, agi, int)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Arma 2H ───────────────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, true, 'universal',
  greatest(0, round(base.atk * base.tier * r.mult)::int),
  greatest(0, round(base.def * base.tier * r.mult)::int),
  greatest(0, round(base.hp  * base.tier * r.mult)::int),
  greatest(0, round(base.str * base.tier * r.mult)::int),
  greatest(0, round(base.agi * base.tier * r.mult)::int),
  greatest(0, round(base.int * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Mandoble del Equilibrio', 'main_hand', 1, 5, 0, 5, 2, 1, 2),
  ('Mandoble Ancestral',      'main_hand', 2, 5, 0, 5, 2, 1, 2),
  ('Mandoble Primordial',     'main_hand', 3, 5, 0, 5, 2, 1, 2)
) AS base(name, slot, tier, atk, def, hp, str, agi, int)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Off-hand ──────────────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'universal',
  greatest(0, round(base.atk * base.tier * r.mult)::int),
  greatest(0, round(base.def * base.tier * r.mult)::int),
  greatest(0, round(base.hp  * base.tier * r.mult)::int),
  greatest(0, round(base.str * base.tier * r.mult)::int),
  greatest(0, round(base.agi * base.tier * r.mult)::int),
  greatest(0, round(base.int * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Escudo del Pactante', 'off_hand', 1, 0, 3, 5, 1, 1, 1),
  ('Escudo Ancestral',    'off_hand', 2, 0, 3, 5, 1, 1, 1),
  ('Escudo Primordial',   'off_hand', 3, 0, 3, 5, 1, 1, 1)
) AS base(name, slot, tier, atk, def, hp, str, agi, int)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);

-- ── Accesorio ─────────────────────────────────────────────────────────────────
INSERT INTO public.item_catalog
  (name, slot, tier, rarity, is_two_handed, required_class,
   attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus,
   max_durability)
SELECT
  base.name, base.slot, base.tier, r.rarity, false, 'universal',
  greatest(0, round(base.atk * base.tier * r.mult)::int),
  greatest(0, round(base.def * base.tier * r.mult)::int),
  greatest(0, round(base.hp  * base.tier * r.mult)::int),
  greatest(0, round(base.str * base.tier * r.mult)::int),
  greatest(0, round(base.agi * base.tier * r.mult)::int),
  greatest(0, round(base.int * base.tier * r.mult)::int),
  r.max_dur
FROM (VALUES
  ('Amuleto del Equilibrio', 'accessory', 1, 1, 1, 3, 1, 2, 2),
  ('Amuleto Ancestral',      'accessory', 2, 1, 1, 3, 1, 2, 2),
  ('Amuleto Primordial',     'accessory', 3, 1, 1, 3, 1, 2, 2)
) AS base(name, slot, tier, atk, def, hp, str, agi, int)
CROSS JOIN (VALUES
  ('common',    1.0::float, 50),
  ('uncommon',  1.2::float, 65),
  ('rare',      1.5::float, 80),
  ('epic',      1.8::float, 100),
  ('legendary', 2.5::float, 120)
) AS r(rarity, mult, max_dur);
