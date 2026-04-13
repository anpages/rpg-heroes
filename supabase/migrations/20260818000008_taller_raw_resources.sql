-- Elimina el paso intermedio del Refinado:
--   · Borra recetas T1 (steel_ingot, plank, mana_crystal, herbal_extract)
--   · Actualiza Taller para usar recursos brutos directamente
--   · Añade runas de Fuerza, Agilidad e Inteligencia (6 runas en total)
--   · Cap de encantamientos por tier gestionado en el backend

-- 1. Limpiar slots de refinado T1 activos
DELETE FROM player_refining_slots
WHERE recipe_id IN ('steel_ingot','plank','mana_crystal','herbal_extract');

DELETE FROM player_crafting_queue
WHERE recipe_id IN ('steel_ingot','plank','mana_crystal','herbal_extract');

-- 2. Limpiar stock de materiales refinados T1
DELETE FROM player_crafted_items
WHERE recipe_id IN ('steel_ingot','plank','mana_crystal','herbal_extract');

-- 3. Eliminar recetas T1 del catálogo
DELETE FROM crafting_catalog
WHERE id IN ('steel_ingot','plank','mana_crystal','herbal_extract');

-- 4. Actualizar runas existentes a ingredientes brutos
UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":15},{"resource":"mana","qty":5}]'::jsonb
WHERE id = 'rune_attack';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":15},{"resource":"wood","qty":5}]'::jsonb
WHERE id = 'rune_defense';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"wood","qty":10},{"resource":"herbs","qty":10}]'::jsonb
WHERE id = 'rune_hp';

-- 5. Añadir runas nuevas (Fuerza, Agilidad, Inteligencia)
INSERT INTO crafting_catalog
  (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  (
    'rune_strength',
    'Runa de Fuerza',
    'Aplica +8 de fuerza permanente a un ítem de equipo.',
    'rune', '💪',
    '[{"resource":"iron","qty":12},{"resource":"herbs","qty":8}]'::jsonb,
    1, 15, 1, 'laboratory', 0,
    '[{"type":"enchant","stat":"strength_bonus","value":8}]'::jsonb
  ),
  (
    'rune_agility',
    'Runa de Agilidad',
    'Aplica +8 de agilidad permanente a un ítem de equipo.',
    'rune', '💨',
    '[{"resource":"wood","qty":8},{"resource":"mana","qty":8}]'::jsonb,
    1, 15, 1, 'laboratory', 0,
    '[{"type":"enchant","stat":"agility_bonus","value":8}]'::jsonb
  ),
  (
    'rune_intelligence',
    'Runa de Inteligencia',
    'Aplica +8 de inteligencia permanente a un ítem de equipo.',
    'rune', '🔮',
    '[{"resource":"mana","qty":12},{"resource":"herbs","qty":8}]'::jsonb,
    1, 15, 1, 'laboratory', 0,
    '[{"type":"enchant","stat":"intelligence_bonus","value":8}]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  inputs = EXCLUDED.inputs,
  effects = EXCLUDED.effects;

-- 6. Actualizar forge stones a recursos brutos
UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":20},{"resource":"wood","qty":10},{"resource":"fragments","qty":2}]'::jsonb
WHERE id = 'forge_stone_t2';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":30},{"resource":"wood","qty":20},{"resource":"mana","qty":10},{"resource":"essence","qty":4}]'::jsonb
WHERE id = 'forge_stone_t3';

-- 7. Actualizar provisiones a recursos brutos
UPDATE crafting_catalog SET
  inputs = '[{"resource":"wood","qty":15},{"resource":"herbs","qty":15}]'::jsonb
WHERE id = 'expedition_provisions';
