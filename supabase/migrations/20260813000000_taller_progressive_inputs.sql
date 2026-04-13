-- ══════════════════════════════════════════════════════════════════════════════
-- Taller: recetas progresivas — el tier mayor requiere el tier menor como input
-- (al igual que el refinado donde T2 usa productos T1)
-- ══════════════════════════════════════════════════════════════════════════════

-- Poción de Vida Mayor: antes potion_base×2 + herbal_extract×2
-- Ahora: hp_potion_minor×1 + concentrated_mana×1 + herbal_extract×1
UPDATE crafting_catalog
SET inputs = '[{"item":"hp_potion_minor","qty":1},{"item":"concentrated_mana","qty":1},{"item":"herbal_extract","qty":1}]'::jsonb
WHERE id = 'hp_potion_major';

-- Kit de Reparación Completo: antes reinforced_frame×1 + armor_plate×1 + herbal_extract×1
-- Ahora: repair_kit×1 + tempered_steel×1 + composite_wood×1
UPDATE crafting_catalog
SET inputs = '[{"item":"repair_kit","qty":1},{"item":"tempered_steel","qty":1},{"item":"composite_wood","qty":1}]'::jsonb
WHERE id = 'repair_kit_full';

-- Piedra de Forja T3: antes steel_gear×2 + mana_lens×1 + essence×4
-- Ahora: forge_stone_t2×1 + steel_gear×1 + mana_lens×1 + essence×4
UPDATE crafting_catalog
SET inputs = '[{"item":"forge_stone_t2","qty":1},{"item":"steel_gear","qty":1},{"item":"mana_lens","qty":1},{"resource":"essence","qty":4}]'::jsonb
WHERE id = 'forge_stone_t3';
