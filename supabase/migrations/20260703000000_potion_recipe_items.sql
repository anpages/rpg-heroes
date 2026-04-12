-- ══════════════════════════════════════════════════════════════════════════════
-- Pociones: reemplazar costes en recursos crudos por ingredientes procesados
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Añadir columna recipe_items (jsonb) a potion_catalog
ALTER TABLE potion_catalog
  ADD COLUMN IF NOT EXISTS recipe_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Asignar recipe_items a cada poción y resetear costes legacy

-- ── Nivel 1 ──────────────────────────────────────────────────────────────────
UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"herbal_extract","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'hp_minor';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"steel_ingot","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'vigor';

-- ── Nivel 2 ──────────────────────────────────────────────────────────────────
UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"herbal_extract","qty":2}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'hp_standard';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"plank","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'shield_minor';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"mana_crystal","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'focus';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"mana_crystal","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'brisa_errante';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"herbal_extract","qty":1},{"item":"steel_ingot","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'aceite_forjador';

-- ── Nivel 3 ──────────────────────────────────────────────────────────────────
UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":2},{"item":"herbal_extract","qty":2}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'hp_major';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"tempered_steel","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'power';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"composite_wood","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'shield';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"concentrated_mana","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'wisdom';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"concentrated_mana","qty":1},{"resource":"fragments","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'paso_viajero';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"tempered_steel","qty":1},{"resource":"fragments","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'saqueador_ojo';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"steel_ingot","qty":2},{"resource":"fragments","qty":1}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'alquimia_mercader';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":1},{"item":"concentrated_mana","qty":1},{"resource":"fragments","qty":2}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'carta_vidente';

-- ── Nivel 4 ──────────────────────────────────────────────────────────────────
UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":2},{"item":"tempered_steel","qty":2}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'fury';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":2},{"item":"composite_wood","qty":2}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'fortitude';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":2},{"item":"herbal_extract","qty":3}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'hp_supreme';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":2},{"item":"concentrated_mana","qty":2}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'enlighten';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":2},{"item":"concentrated_mana","qty":2},{"resource":"fragments","qty":2}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'huellas_viento';

-- ── Nivel 5 ──────────────────────────────────────────────────────────────────
UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":3},{"item":"tempered_steel","qty":3}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'war_elixir';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":3},{"item":"composite_wood","qty":3}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'divine_shield';

UPDATE potion_catalog SET
  recipe_items = '[{"item":"potion_base","qty":3},{"item":"concentrated_mana","qty":3}]'::jsonb,
  recipe_gold = 0, recipe_iron = 0, recipe_wood = 0, recipe_mana = 0, recipe_fragments = 0, recipe_essence = 0
WHERE id = 'transcendence';
