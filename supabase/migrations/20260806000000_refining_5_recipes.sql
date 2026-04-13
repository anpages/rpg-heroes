-- ══════════════════════════════════════════════════════════════════════════════
-- Refinado: 5 recetas por edificio (1 por nivel), bonus velocidad por nivel
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Mover recetas existentes de Nv3 → Nv2
UPDATE crafting_catalog SET min_refinery_level = 2 WHERE id = 'composite_wood';
UPDATE crafting_catalog SET min_refinery_level = 2 WHERE id = 'tempered_steel';
UPDATE crafting_catalog SET min_refinery_level = 2 WHERE id = 'concentrated_mana';
UPDATE crafting_catalog SET min_refinery_level = 2 WHERE id = 'potion_base';

-- Ajustar tiempos de las existentes Nv2 (antes 5min → 4min)
UPDATE crafting_catalog SET craft_minutes = 4 WHERE id IN ('composite_wood', 'tempered_steel', 'concentrated_mana', 'potion_base');

-- 2. Nuevas recetas Nv3 ─────────────────────────────────────────────────────────

INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level)
VALUES
  ('reinforced_frame',  'Marco Reforzado',    'Estructura de madera reforzada con fibra trenzada.',
   'refining', '🪵', '[{"resource":"wood","qty":6},{"resource":"fiber","qty":3}]', 1, 6, 0, 'carpinteria', 3),

  ('armor_plate',       'Placa de Blindaje',  'Plancha de acero endurecida con carbón.',
   'refining', '🛡️', '[{"resource":"iron","qty":6},{"resource":"coal","qty":3}]', 1, 6, 0, 'fundicion', 3),

  ('arcane_prism',      'Prisma Arcano',      'Cristal tallado que refracta energía mágica.',
   'refining', '🔮', '[{"resource":"mana","qty":6},{"resource":"arcane_dust","qty":3}]', 1, 6, 0, 'destileria_arcana', 3),

  ('concentrated_elixir','Elixir Concentrado', 'Destilado herbal de alta potencia.',
   'refining', '🧪', '[{"resource":"herbs","qty":4},{"resource":"flowers","qty":3}]', 1, 6, 0, 'herbolario', 3)
ON CONFLICT (id) DO NOTHING;

-- 3. Nuevas recetas Nv4 ─────────────────────────────────────────────────────────

INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level)
VALUES
  ('master_beam',       'Viga Maestra',       'Pieza estructural de madera y fibra de alta resistencia.',
   'refining', '🪵', '[{"resource":"wood","qty":8},{"resource":"fiber","qty":5}]', 1, 8, 0, 'carpinteria', 4),

  ('steel_gear',        'Engranaje de Acero', 'Pieza mecánica de precisión forjada en acero.',
   'refining', '⚙️', '[{"resource":"iron","qty":8},{"resource":"coal","qty":5}]', 1, 8, 0, 'fundicion', 4),

  ('mana_lens',         'Lente de Maná',      'Lente pulida que canaliza energía arcana.',
   'refining', '🔍', '[{"resource":"mana","qty":8},{"resource":"arcane_dust","qty":5}]', 1, 8, 0, 'destileria_arcana', 4),

  ('essential_oil',     'Aceite Esencial',    'Destilado concentrado de hierbas y flores.',
   'refining', '🫗', '[{"resource":"herbs","qty":6},{"resource":"flowers","qty":5}]', 1, 8, 0, 'herbolario', 4)
ON CONFLICT (id) DO NOTHING;

-- 4. Nuevas recetas Nv5 ─────────────────────────────────────────────────────────

INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level)
VALUES
  ('assembled_panel',   'Panel Ensamblado',   'Panel multicapa de madera y fibra entrelazada.',
   'refining', '🪵', '[{"resource":"wood","qty":12},{"resource":"fiber","qty":7}]', 1, 10, 0, 'carpinteria', 5),

  ('forged_steel',      'Acero Forjado',      'Acero trabajado a altas temperaturas con carbón puro.',
   'refining', '🔨', '[{"resource":"iron","qty":12},{"resource":"coal","qty":7}]', 1, 10, 0, 'fundicion', 5),

  ('arcane_condenser',  'Condensador Arcano', 'Dispositivo que almacena y comprime energía mágica.',
   'refining', '⚗️', '[{"resource":"mana","qty":12},{"resource":"arcane_dust","qty":7}]', 1, 10, 0, 'destileria_arcana', 5),

  ('cataplasm',         'Cataplasma',         'Preparado medicinal espeso de hierbas y flores.',
   'refining', '🩹', '[{"resource":"herbs","qty":8},{"resource":"flowers","qty":7}]', 1, 10, 0, 'herbolario', 5)
ON CONFLICT (id) DO NOTHING;
