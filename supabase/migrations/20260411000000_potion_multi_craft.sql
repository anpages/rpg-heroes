-- Permitir múltiples crafteos simultáneos de la misma poción.
-- Antes: PK (player_id, potion_id) → máximo 1 craft activo por receta.
-- Ahora: surrogate id → N crafts concurrentes de la misma receta.

ALTER TABLE player_potion_crafting DROP CONSTRAINT IF EXISTS player_potion_crafting_pkey;

ALTER TABLE player_potion_crafting
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE player_potion_crafting ADD PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS idx_player_potion_crafting_player
  ON player_potion_crafting (player_id);
