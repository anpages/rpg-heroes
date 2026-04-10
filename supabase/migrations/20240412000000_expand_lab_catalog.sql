-- ═══════════════════════════════════════════════════════════════════════════════
-- Ampliación del catálogo del Laboratorio
-- - Añadir craft_minutes a rune_catalog
-- - Redistribuir min_lab_level en pociones y runas (niveles 1-5)
-- - Añadir descripciones, corregir costes (maná obligatorio en runas)
-- - Insertar nuevas recetas de pociones (11) y runas (9)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Añadir craft_minutes a rune_catalog ──────────────────────────────────────
ALTER TABLE rune_catalog ADD COLUMN IF NOT EXISTS craft_minutes integer NOT NULL DEFAULT 60;

-- ── 2. Actualizar pociones existentes ───────────────────────────────────────────

-- hp_minor: se queda en nivel 1, ajustar descripción
UPDATE potion_catalog SET
  description   = 'Restaura el 30% de los puntos de vida del héroe.',
  min_lab_level = 1,
  recipe_gold   = 50,
  recipe_mana   = 20,
  craft_minutes = 5
WHERE id = 'hp_minor';

-- hp_major: sube a nivel 3
UPDATE potion_catalog SET
  description   = 'Restaura el 70% de los puntos de vida del héroe.',
  min_lab_level = 3,
  recipe_gold   = 100,
  recipe_mana   = 75,
  craft_minutes = 10
WHERE id = 'hp_major';

-- power: sube a nivel 3
UPDATE potion_catalog SET
  name          = 'Elixir de poder',
  description   = 'Aumenta el ataque del héroe un 20% en el próximo combate.',
  min_lab_level = 3,
  recipe_gold   = 80,
  recipe_mana   = 50,
  craft_minutes = 10
WHERE id = 'power';

-- shield: sube a nivel 3
UPDATE potion_catalog SET
  name          = 'Elixir de escudo',
  description   = 'Aumenta la defensa del héroe un 20% en el próximo combate.',
  min_lab_level = 3,
  recipe_gold   = 80,
  recipe_mana   = 50,
  craft_minutes = 10
WHERE id = 'shield';

-- wisdom: sube a nivel 3
UPDATE potion_catalog SET
  name          = 'Elixir de sabiduría',
  description   = 'Aumenta la experiencia obtenida un 50% en la próxima expedición.',
  min_lab_level = 3,
  recipe_gold   = 60,
  recipe_mana   = 65,
  craft_minutes = 10
WHERE id = 'wisdom';

-- ── 3. Insertar nuevas pociones ─────────────────────────────────────────────────

INSERT INTO potion_catalog (id, name, description, effect_type, effect_value, recipe_gold, recipe_wood, recipe_mana, craft_minutes, min_lab_level) VALUES
  -- Nivel 1
  ('vigor',          'Elixir de vigor',         'Aumenta el ataque del héroe un 10% en el próximo combate.',              'atk_boost',  0.10,  40, 0,  25,  5, 1),
  -- Nivel 2
  ('hp_standard',    'Poción de vida',          'Restaura el 50% de los puntos de vida del héroe.',                       'hp_restore', 0.50,  80, 0,  45,  8, 2),
  ('shield_minor',   'Escudo menor',            'Aumenta la defensa del héroe un 10% en el próximo combate.',             'def_boost',  0.10,  40, 0,  25,  5, 2),
  ('focus',          'Poción de concentración', 'Aumenta la experiencia obtenida un 25% en la próxima expedición.',       'xp_boost',   0.25,  50, 0,  35,  8, 2),
  -- Nivel 4
  ('fury',           'Poción de furia',         'Aumenta el ataque del héroe un 35% en el próximo combate.',              'atk_boost',  0.35, 130, 0, 100, 15, 4),
  ('fortitude',      'Poción de fortaleza',     'Aumenta la defensa del héroe un 35% en el próximo combate.',             'def_boost',  0.35, 130, 0, 100, 15, 4),
  ('hp_supreme',     'Poción de vida suprema',  'Restaura completamente los puntos de vida del héroe.',                   'hp_restore', 1.00, 160, 0, 120, 15, 4),
  ('enlighten',      'Poción de iluminación',   'Aumenta la experiencia obtenida un 80% en la próxima expedición.',       'xp_boost',   0.80, 120, 0, 110, 15, 4),
  -- Nivel 5
  ('war_elixir',     'Elixir de guerra',        'Aumenta el ataque del héroe un 50% en el próximo combate.',              'atk_boost',  0.50, 200, 0, 160, 20, 5),
  ('divine_shield',  'Protección divina',       'Aumenta la defensa del héroe un 50% en el próximo combate.',             'def_boost',  0.50, 200, 0, 160, 20, 5),
  ('transcendence',  'Trascendencia',           'Duplica la experiencia obtenida en la próxima expedición.',              'xp_boost',   1.00, 180, 0, 180, 20, 5)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Actualizar runas existentes ──────────────────────────────────────────────

-- Fuego → Fuego I, nivel 2, coste reducido
UPDATE rune_catalog SET
  name          = 'Runa de Fuego I',
  description   = 'Infunde el equipo con llamas, aumentando ligeramente el ataque.',
  bonuses       = '[{"stat":"attack","value":3}]',
  recipe_gold   = 60,
  recipe_wood   = 0,
  recipe_mana   = 35,
  min_lab_level = 2,
  craft_minutes = 30
WHERE id = 1;

-- Hielo → Hielo I, nivel 2
UPDATE rune_catalog SET
  name          = 'Runa de Hielo I',
  description   = 'Endurece el equipo con escarcha protectora.',
  bonuses       = '[{"stat":"defense","value":3}]',
  recipe_gold   = 60,
  recipe_wood   = 0,
  recipe_mana   = 35,
  min_lab_level = 2,
  craft_minutes = 30
WHERE id = 2;

-- Tormenta → nivel 3
UPDATE rune_catalog SET
  name          = 'Runa de Tormenta',
  description   = 'Canaliza energía arcana para potenciar la inteligencia.',
  bonuses       = '[{"stat":"intelligence","value":5}]',
  recipe_gold   = 100,
  recipe_wood   = 0,
  recipe_mana   = 65,
  min_lab_level = 3,
  craft_minutes = 45
WHERE id = 3;

-- Viento → Viento I, nivel 2
UPDATE rune_catalog SET
  name          = 'Runa de Viento I',
  description   = 'Aporta ligereza y velocidad de reacción.',
  bonuses       = '[{"stat":"agility","value":3}]',
  recipe_gold   = 60,
  recipe_wood   = 0,
  recipe_mana   = 35,
  min_lab_level = 2,
  craft_minutes = 30
WHERE id = 4;

-- Tierra → nivel 3, ahora usa maná
UPDATE rune_catalog SET
  name          = 'Runa de Tierra',
  description   = 'Refuerza el cuerpo con la vitalidad de la tierra.',
  bonuses       = '[{"stat":"max_hp","value":20}]',
  recipe_gold   = 80,
  recipe_wood   = 0,
  recipe_mana   = 55,
  min_lab_level = 3,
  craft_minutes = 45
WHERE id = 5;

-- Luz → Equilibrio, nivel 4
UPDATE rune_catalog SET
  name          = 'Runa de Equilibrio',
  description   = 'Equilibra ataque, defensa e inteligencia a partes iguales.',
  bonuses       = '[{"stat":"attack","value":3},{"stat":"defense","value":3},{"stat":"intelligence","value":3}]',
  recipe_gold   = 150,
  recipe_wood   = 0,
  recipe_mana   = 100,
  min_lab_level = 4,
  craft_minutes = 60
WHERE id = 6;

-- ── 5. Insertar nuevas runas ────────────────────────────────────────────────────

INSERT INTO rune_catalog (name, description, bonuses, recipe_gold, recipe_wood, recipe_mana, min_lab_level, craft_minutes) VALUES
  -- Nivel 3: puras (especialización)
  ('Runa de Fuego II',    'Intensifica las llamas, aumentando notablemente el ataque.',                    '[{"stat":"attack","value":6}]',                                              100, 0,  65, 3, 45),
  ('Runa de Hielo II',    'Capa de hielo reforzada que aumenta la defensa.',                               '[{"stat":"defense","value":5}]',                                             100, 0,  65, 3, 45),
  ('Runa de Viento II',   'Vientos huracanados que potencian la agilidad.',                                '[{"stat":"agility","value":5}]',                                             100, 0,  65, 3, 45),
  -- Nivel 3: duales (versatilidad, menos stat total pero cubren dos roles)
  ('Runa de Batalla',     'Combina filo y velocidad: ideal para guerreros ágiles.',                        '[{"stat":"attack","value":3},{"stat":"agility","value":2}]',                  110, 0,  70, 3, 45),
  ('Runa de Bastión',     'Fortalece el cuerpo y el espíritu: más resistente en todos los frentes.',       '[{"stat":"defense","value":3},{"stat":"max_hp","value":12}]',                 110, 0,  70, 3, 45),
  ('Runa del Arcanista',  'El conocimiento arcano se traduce en poder ofensivo.',                          '[{"stat":"intelligence","value":3},{"stat":"attack","value":2}]',             110, 0,  70, 3, 45),
  -- Nivel 4: puras (máxima especialización)
  ('Runa de Fuego III',   'Fuego abrasador que maximiza el poder ofensivo.',                               '[{"stat":"attack","value":10}]',                                             160, 0, 110, 4, 60),
  ('Runa de Hielo III',   'Coraza glacial que ofrece una defensa formidable.',                             '[{"stat":"defense","value":8}]',                                             160, 0, 110, 4, 60),
  ('Runa de Tierra II',   'La fuerza de la montaña fluye por el equipo, aumentando la vitalidad.',         '[{"stat":"max_hp","value":40}]',                                             140, 0, 100, 4, 60),
  -- Nivel 4: duales (combos potentes con trade-off)
  ('Runa del Centinela',  'Combina agilidad y resistencia: perfecto para vigilar sin caer.',               '[{"stat":"defense","value":5},{"stat":"agility","value":4}]',                 170, 0, 115, 4, 60),
  ('Runa del Berserker',  'Fuerza bruta compensada con vitalidad para aguantar el combate.',               '[{"stat":"attack","value":6},{"stat":"max_hp","value":25}]',                  170, 0, 115, 4, 60),
  -- Nivel 5: todas combinadas (las más poderosas)
  ('Runa Ancestral',      'Poder de los antiguos héroes: potencia ataque, defensa y agilidad.',            '[{"stat":"attack","value":5},{"stat":"defense","value":5},{"stat":"agility","value":5}]', 250, 0, 180, 5, 90),
  ('Runa Vital',          'Esencia de vida concentrada que refuerza vitalidad y resistencia.',              '[{"stat":"max_hp","value":60},{"stat":"defense","value":4}]',                 220, 0, 160, 5, 90),
  ('Runa Arcana',         'Canaliza magia pura para potenciar inteligencia y ataque.',                     '[{"stat":"intelligence","value":8},{"stat":"attack","value":4}]',             220, 0, 170, 5, 90);
