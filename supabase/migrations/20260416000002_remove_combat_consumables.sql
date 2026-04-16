-- Eliminar todos los consumibles de combate del catálogo de crafteo.
-- El loop PvE se basa en expediciones para progreso, no en consumibles de combate.
-- Se conservan: pocion_vida (hp_restore) y provisiones (expedition_bonus).

-- Limpiar inventario de jugadores de estos items
DELETE FROM player_crafted_items
WHERE recipe_id IN (
  SELECT id FROM crafting_catalog
  WHERE effects @> '[{"type":"atk_boost"}]'::jsonb
     OR effects @> '[{"type":"def_boost"}]'::jsonb
     OR effects @> '[{"type":"tower_shield"}]'::jsonb
     OR effects @> '[{"type":"crit_boost"}]'::jsonb
     OR effects @> '[{"type":"armor_pen"}]'::jsonb
     OR effects @> '[{"type":"combat_shield"}]'::jsonb
     OR effects @> '[{"type":"lifesteal_pct"}]'::jsonb
);

-- Limpiar slots de laboratorio activos con estas recetas
DELETE FROM player_refining_slots
WHERE recipe_id IN (
  SELECT id FROM crafting_catalog
  WHERE effects @> '[{"type":"atk_boost"}]'::jsonb
     OR effects @> '[{"type":"def_boost"}]'::jsonb
     OR effects @> '[{"type":"tower_shield"}]'::jsonb
     OR effects @> '[{"type":"crit_boost"}]'::jsonb
     OR effects @> '[{"type":"armor_pen"}]'::jsonb
     OR effects @> '[{"type":"combat_shield"}]'::jsonb
     OR effects @> '[{"type":"lifesteal_pct"}]'::jsonb
);

-- Limpiar active_effects en héroes que tengan estos efectos activos
UPDATE heroes
SET active_effects = active_effects
  - 'atk_boost'
  - 'def_boost'
  - 'tower_shield'
  - 'crit_boost'
  - 'armor_pen'
  - 'combat_shield'
  - 'lifesteal_pct'
WHERE active_effects IS NOT NULL
  AND (
    active_effects ? 'atk_boost' OR
    active_effects ? 'def_boost' OR
    active_effects ? 'tower_shield' OR
    active_effects ? 'crit_boost' OR
    active_effects ? 'armor_pen' OR
    active_effects ? 'combat_shield' OR
    active_effects ? 'lifesteal_pct'
  );

-- Eliminar las recetas del catálogo
DELETE FROM crafting_catalog
WHERE effects @> '[{"type":"atk_boost"}]'::jsonb
   OR effects @> '[{"type":"def_boost"}]'::jsonb
   OR effects @> '[{"type":"tower_shield"}]'::jsonb
   OR effects @> '[{"type":"crit_boost"}]'::jsonb
   OR effects @> '[{"type":"armor_pen"}]'::jsonb
   OR effects @> '[{"type":"combat_shield"}]'::jsonb
   OR effects @> '[{"type":"lifesteal_pct"}]'::jsonb;
