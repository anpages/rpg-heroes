-- ══════════════════════════════════════════════════════════════════════════════
-- Cadenas de procesamiento: recursos secundarios, jardín de hierbas, refinado
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Nuevas columnas de recursos secundarios en la tabla resources
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS coal        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiber       int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arcane_dust int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS herbs       int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flowers     int NOT NULL DEFAULT 0;

-- 2. Insertar edificio herb_garden para todos los jugadores existentes
--    Nivel 0 (sin construir), desbloqueado (se construye cuando base ≥ 2)
INSERT INTO buildings (player_id, type, level, unlocked)
SELECT p.id, 'herb_garden', 0, true
FROM players p
WHERE NOT EXISTS (
  SELECT 1 FROM buildings b WHERE b.player_id = p.id AND b.type = 'herb_garden'
);

-- 3. Recetas de refinado — categoría 'refining'
--    Básicas (Taller Lv1, 3 min)
INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level)
VALUES
  ('steel_ingot',    'Lingote de Acero',  'Refina mineral crudo en un lingote resistente.',   'refining', '🔩', '[{"resource":"iron","qty":3}]',  1, 3, 1),
  ('plank',          'Tablón',            'Madera procesada, lista para construir.',           'refining', '🪵', '[{"resource":"wood","qty":3}]',  1, 3, 1),
  ('mana_crystal',   'Cristal de Maná',   'Maná cristalizado en una gema pura.',               'refining', '💎', '[{"resource":"mana","qty":3}]',  1, 3, 1),
  ('herbal_extract', 'Extracto Herbal',   'Esencia concentrada de hierbas medicinales.',       'refining', '🌿', '[{"resource":"herbs","qty":3}]', 1, 3, 1)
ON CONFLICT (id) DO NOTHING;

-- Avanzadas (Taller Lv3, 5 min, requieren recurso secundario)
INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level)
VALUES
  ('tempered_steel',     'Acero Templado',     'Aleación superior forjada con carbón.',                 'refining', '⚔️', '[{"resource":"iron","qty":4},{"resource":"coal","qty":2}]',        1, 5, 3),
  ('composite_wood',     'Madera Compuesta',   'Material compuesto de fibra y madera.',                 'refining', '🏗️', '[{"resource":"wood","qty":4},{"resource":"fiber","qty":2}]',       1, 5, 3),
  ('concentrated_mana',  'Maná Concentrado',   'Energía arcana destilada y potente.',                   'refining', '✨', '[{"resource":"mana","qty":4},{"resource":"arcane_dust","qty":2}]', 1, 5, 3),
  ('potion_base',        'Base de Poción',     'Preparado alquímico base para cualquier poción.',       'refining', '⚗️', '[{"resource":"herbs","qty":2},{"resource":"flowers","qty":2}]',    1, 5, 3)
ON CONFLICT (id) DO NOTHING;
