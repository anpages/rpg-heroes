-- ══════════════════════════════════════════════════════════════════════════════
-- Refining slots: producción continua sin bloqueo, múltiples recetas en paralelo
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS player_refining_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  building_type text NOT NULL,
  recipe_id text NOT NULL REFERENCES crafting_catalog(id),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  craft_started_at timestamptz NOT NULL DEFAULT now(),
  unit_duration_ms int NOT NULL CHECK (unit_duration_ms > 0),
  UNIQUE(player_id, building_type, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_refining_slots_player ON player_refining_slots(player_id);

-- Migrar jobs de refinado existentes al nuevo sistema
-- (cada job se convierte en un slot con quantity=1)
INSERT INTO player_refining_slots (player_id, building_type, recipe_id, quantity, craft_started_at, unit_duration_ms)
SELECT
  q.player_id,
  q.building_type,
  q.recipe_id,
  1,
  q.craft_ends_at::timestamptz - (c.craft_minutes * 60 * interval '1 second'),
  c.craft_minutes * 60 * 1000
FROM player_crafting_queue q
JOIN crafting_catalog c ON c.id = q.recipe_id
WHERE q.building_type IS NOT NULL
ON CONFLICT (player_id, building_type, recipe_id) DO NOTHING;

-- Limpiar jobs de refinado de la cola vieja
DELETE FROM player_crafting_queue WHERE building_type IS NOT NULL;

-- Habilitar RLS
ALTER TABLE player_refining_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own refining slots"
  ON player_refining_slots
  FOR ALL
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());
