-- ── Sistema Idle: Producción manual + Crafteo de items ──────────────────────
--
-- Convierte la base en el corazón idle del juego:
--   1. Recursos se acumulan en edificios → recolección manual
--   2. Items crafteados (kits, piedras, pergaminos) → únicos para reparar/mejorar
--   3. Cámaras eliminadas (redundantes con el nuevo loop)
--
-- Tablas nuevas: crafting_catalog, player_crafted_items, player_crafting_queue
-- Tablas modificadas: buildings (production_collected_at), potion_catalog (recipe_iron)
-- Tablas eliminadas: chamber_runs

-- ── 1. Producción manual: timestamp de recolección ──────────────────────────

ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS production_collected_at timestamptz DEFAULT now();

-- Inicializar para edificios existentes
UPDATE buildings
SET production_collected_at = now()
WHERE production_collected_at IS NULL;

-- ── 2. Catálogo de crafteo ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crafting_catalog (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  description   text,
  category      text NOT NULL,     -- 'repair', 'upgrade', 'tactic', 'training'
  icon          text DEFAULT '🔧',
  inputs        jsonb NOT NULL DEFAULT '[]',
  output_qty    int NOT NULL DEFAULT 1,
  craft_minutes int NOT NULL DEFAULT 15,
  min_lab_level int NOT NULL DEFAULT 1
);

ALTER TABLE crafting_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crafting_catalog: public read"
  ON crafting_catalog FOR SELECT
  USING (true);

-- ── 3. Inventario de items crafteados ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_crafted_items (
  player_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id  text NOT NULL REFERENCES crafting_catalog(id),
  quantity   int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (player_id, recipe_id)
);

ALTER TABLE player_crafted_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_crafted_items: own read"
  ON player_crafted_items FOR SELECT
  USING (auth.uid() = player_id);

-- ── 4. Cola de crafteo ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_crafting_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id    text NOT NULL REFERENCES crafting_catalog(id),
  craft_ends_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crafting_queue_player
  ON player_crafting_queue (player_id);

ALTER TABLE player_crafting_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_crafting_queue: own read"
  ON player_crafting_queue FOR SELECT
  USING (auth.uid() = player_id);

-- ── 5. Seed: recetas de crafteo ─────────────────────────────────────────────

INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level) VALUES
  -- Reparación
  ('repair_kit',
   'Kit de Reparación',
   'Repara un objeto equipado, restaurando toda su durabilidad.',
   'repair', '🔧',
   '[{"resource":"iron","qty":4},{"resource":"wood","qty":3}]'::jsonb,
   1, 10, 1),

  ('repair_kit_full',
   'Kit de Reparación Completo',
   'Repara TODO el equipo de un héroe de una sola vez.',
   'repair', '🛠️',
   '[{"resource":"iron","qty":10},{"resource":"wood","qty":8},{"resource":"mana","qty":3}]'::jsonb,
   1, 25, 2),

  -- Mejora de tier
  ('forge_stone_t2',
   'Piedra de Forja T2',
   'Mejora un objeto de Tier 1 a Tier 2.',
   'upgrade', '🪨',
   '[{"resource":"iron","qty":8},{"resource":"wood","qty":5},{"resource":"fragments","qty":2}]'::jsonb,
   1, 20, 1),

  ('forge_stone_t3',
   'Piedra de Forja T3',
   'Mejora un objeto de Tier 2 a Tier 3.',
   'upgrade', '💎',
   '[{"resource":"iron","qty":18},{"resource":"wood","qty":12},{"resource":"fragments","qty":6},{"resource":"essence","qty":2}]'::jsonb,
   1, 40, 3),

  -- Tácticas
  ('tactic_scroll',
   'Pergamino Táctico',
   'Sube 1 nivel de la táctica elegida (máx. 5).',
   'tactic', '📜',
   '[{"resource":"mana","qty":6},{"resource":"fragments","qty":3}]'::jsonb,
   1, 20, 2),

  -- Entrenamiento
  ('training_tonic',
   'Tónico de Entrenamiento',
   'Duplica los puntos de entrenamiento de la próxima recolección.',
   'training', '🧪',
   '[{"resource":"wood","qty":4},{"resource":"mana","qty":4}]'::jsonb,
   1, 15, 1)

ON CONFLICT (id) DO NOTHING;

-- ── 6. Añadir recipe_iron a potion_catalog ──────────────────────────────────

ALTER TABLE potion_catalog
  ADD COLUMN IF NOT EXISTS recipe_iron int NOT NULL DEFAULT 0;

-- Migrar costes de pociones: quitar oro, añadir iron como coste alternativo
-- Las pociones pasan a costar iron/wood/mana en vez de gold/mana
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 3,  recipe_mana = 20  WHERE id = 'hp_minor';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 8,  recipe_mana = 40  WHERE id = 'hp_major';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 5,  recipe_mana = 25  WHERE id = 'power';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 5,  recipe_mana = 25  WHERE id = 'shield';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 3,  recipe_mana = 30  WHERE id = 'wisdom';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 2,  recipe_mana = 15  WHERE id = 'brisa_errante';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 4,  recipe_mana = 30  WHERE id = 'paso_viajero';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 6,  recipe_mana = 45  WHERE id = 'huellas_viento';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 4,  recipe_mana = 20  WHERE id = 'saqueador_ojo';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 3,  recipe_mana = 15  WHERE id = 'alquimia_mercader';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 5,  recipe_mana = 35  WHERE id = 'carta_vidente';
UPDATE potion_catalog SET recipe_gold = 0, recipe_iron = 2,  recipe_mana = 10  WHERE id = 'aceite_forjador';

-- ── 7. Eliminar cámaras ─────────────────────────────────────────────────────

DROP TABLE IF EXISTS chamber_runs;

-- ── 8. Snapshot de recursos antes de pasar a producción manual ───────────────
-- Materializa los recursos acumulados pasivamente y pone rates a 0.
-- Así el jugador no pierde nada en la transición.

UPDATE resources SET
  iron = iron + GREATEST(0, iron_rate * LEAST(24, EXTRACT(EPOCH FROM (now() - last_collected_at)) / 3600)),
  wood = wood + GREATEST(0, wood_rate * LEAST(24, EXTRACT(EPOCH FROM (now() - last_collected_at)) / 3600)),
  mana = mana + GREATEST(0, mana_rate * LEAST(24, EXTRACT(EPOCH FROM (now() - last_collected_at)) / 3600)),
  iron_rate = 0,
  wood_rate = 0,
  mana_rate = 0,
  gold_rate = 0,
  last_collected_at = now();
