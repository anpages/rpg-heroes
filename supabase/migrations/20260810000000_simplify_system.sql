-- ══════════════════════════════════════════════════════════════════════════════
-- Simplificación del sistema: solo 4 recursos primarios, 8 refinados, 6 taller
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Limpiar slots y crafted items de recetas que vamos a eliminar
DELETE FROM player_refining_slots WHERE recipe_id NOT IN (
  'plank', 'composite_wood', 'steel_ingot', 'tempered_steel',
  'mana_crystal', 'concentrated_mana', 'herbal_extract', 'potion_base',
  'hp_potion_minor', 'hp_potion_major', 'repair_kit', 'repair_kit_full',
  'forge_stone_t2', 'forge_stone_t3'
);

DELETE FROM player_crafted_items WHERE recipe_id NOT IN (
  'plank', 'composite_wood', 'steel_ingot', 'tempered_steel',
  'mana_crystal', 'concentrated_mana', 'herbal_extract', 'potion_base',
  'hp_potion_minor', 'hp_potion_major', 'repair_kit', 'repair_kit_full',
  'forge_stone_t2', 'forge_stone_t3'
);

DELETE FROM player_crafting_queue WHERE recipe_id NOT IN (
  'plank', 'composite_wood', 'steel_ingot', 'tempered_steel',
  'mana_crystal', 'concentrated_mana', 'herbal_extract', 'potion_base',
  'hp_potion_minor', 'hp_potion_major', 'repair_kit', 'repair_kit_full',
  'forge_stone_t2', 'forge_stone_t3'
);

-- 2. Eliminar recetas del catálogo que ya no existen
DELETE FROM crafting_catalog WHERE id NOT IN (
  'plank', 'composite_wood', 'steel_ingot', 'tempered_steel',
  'mana_crystal', 'concentrated_mana', 'herbal_extract', 'potion_base',
  'hp_potion_minor', 'hp_potion_major', 'repair_kit', 'repair_kit_full',
  'forge_stone_t2', 'forge_stone_t3'
);

-- 3. Actualizar inputs de refinado: solo recursos primarios
-- Nv1 (10 unidades del recurso primario, 5 min)
UPDATE crafting_catalog SET inputs = '[{"resource":"wood","qty":10}]'::jsonb, craft_minutes = 5 WHERE id = 'plank';
UPDATE crafting_catalog SET inputs = '[{"resource":"iron","qty":10}]'::jsonb, craft_minutes = 5 WHERE id = 'steel_ingot';
UPDATE crafting_catalog SET inputs = '[{"resource":"mana","qty":10}]'::jsonb, craft_minutes = 5 WHERE id = 'mana_crystal';
UPDATE crafting_catalog SET inputs = '[{"resource":"herbs","qty":10}]'::jsonb, craft_minutes = 5 WHERE id = 'herbal_extract';

-- Nv2 (20 unidades del recurso primario, 10 min)
UPDATE crafting_catalog SET inputs = '[{"resource":"wood","qty":20}]'::jsonb, craft_minutes = 10 WHERE id = 'composite_wood';
UPDATE crafting_catalog SET inputs = '[{"resource":"iron","qty":20}]'::jsonb, craft_minutes = 10 WHERE id = 'tempered_steel';
UPDATE crafting_catalog SET inputs = '[{"resource":"mana","qty":20}]'::jsonb, craft_minutes = 10 WHERE id = 'concentrated_mana';
UPDATE crafting_catalog SET inputs = '[{"resource":"herbs","qty":20}]'::jsonb, craft_minutes = 10 WHERE id = 'potion_base';

-- 4. Actualizar inputs del taller para usar solo los 8 materiales que quedan
-- Poción Vida Menor (Nv1): base_poción ×1, extracto ×1
UPDATE crafting_catalog SET
  inputs = '[{"item":"potion_base","qty":1},{"item":"herbal_extract","qty":1}]'::jsonb,
  craft_minutes = 5
WHERE id = 'hp_potion_minor';

-- Kit Reparación (Nv1): lingote ×2, tablón ×1
UPDATE crafting_catalog SET
  inputs = '[{"item":"steel_ingot","qty":2},{"item":"plank","qty":1}]'::jsonb,
  craft_minutes = 10
WHERE id = 'repair_kit';

-- Piedra Forja T2 (Nv2): acero templado ×1, cristal ×1, fragmentos ×2
UPDATE crafting_catalog SET
  inputs = '[{"item":"tempered_steel","qty":1},{"item":"mana_crystal","qty":1},{"resource":"fragments","qty":2}]'::jsonb,
  craft_minutes = 20
WHERE id = 'forge_stone_t2';

-- Poción Vida Mayor (Nv3): base_poción ×2, extracto ×2
UPDATE crafting_catalog SET
  inputs = '[{"item":"potion_base","qty":2},{"item":"herbal_extract","qty":2}]'::jsonb,
  craft_minutes = 10
WHERE id = 'hp_potion_major';

-- Kit Reparación Completo (Nv3): acero templado ×1, madera compuesta ×1, extracto ×1
UPDATE crafting_catalog SET
  inputs = '[{"item":"tempered_steel","qty":1},{"item":"composite_wood","qty":1},{"item":"herbal_extract","qty":1}]'::jsonb,
  craft_minutes = 15
WHERE id = 'repair_kit_full';

-- Piedra Forja T3 (Nv4): acero templado ×2, maná concentrado ×1, esencia ×4
UPDATE crafting_catalog SET
  inputs = '[{"item":"tempered_steel","qty":2},{"item":"concentrated_mana","qty":1},{"resource":"essence","qty":4}]'::jsonb,
  craft_minutes = 30
WHERE id = 'forge_stone_t3';

-- 5. Ajustar niveles del taller
UPDATE crafting_catalog SET min_refinery_level = 1 WHERE id IN ('hp_potion_minor', 'repair_kit');
UPDATE crafting_catalog SET min_refinery_level = 2 WHERE id = 'forge_stone_t2';
UPDATE crafting_catalog SET min_refinery_level = 3 WHERE id IN ('hp_potion_major', 'repair_kit_full');
UPDATE crafting_catalog SET min_refinery_level = 4 WHERE id = 'forge_stone_t3';
