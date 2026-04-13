-- ══════════════════════════════════════════════════════════════════════════════
-- Rebalanceo de tiempos de crafteo: refinado ×4, taller ×3
-- Los tiempos actuales son tan cortos que el refinado/taller nunca es el cuello
-- de botella — el jugador convierte todo al instante y acumula sin esfuerzo.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Refinado T1: 3 → 12 min ─────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 12
WHERE id IN ('plank', 'steel_ingot', 'mana_crystal', 'herbal_extract');

-- ── Refinado T2: 4 → 18 min ─────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 18
WHERE id IN ('composite_wood', 'tempered_steel', 'concentrated_mana', 'potion_base');

-- ── Refinado T3: 6 → 25 min ─────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 25
WHERE id IN ('reinforced_frame', 'armor_plate', 'arcane_prism', 'concentrated_elixir');

-- ── Refinado T4: 8 → 35 min ─────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 35
WHERE id IN ('master_beam', 'steel_gear', 'mana_lens', 'essential_oil');

-- ── Refinado T5: 10 → 45 min ────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 45
WHERE id IN ('assembled_panel', 'forged_steel', 'arcane_condenser', 'cataplasm');

-- ── Taller: Pociones ─────────────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 15  WHERE id = 'hp_potion_minor';
UPDATE crafting_catalog SET craft_minutes = 25  WHERE id = 'atk_elixir';
UPDATE crafting_catalog SET craft_minutes = 25  WHERE id = 'def_elixir';
UPDATE crafting_catalog SET craft_minutes = 30  WHERE id = 'hp_potion_major';

-- ── Taller: Reparación ───────────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 30  WHERE id = 'repair_kit';
UPDATE crafting_catalog SET craft_minutes = 45  WHERE id = 'repair_kit_full';

-- ── Taller: Piedras de Forja ─────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 60  WHERE id = 'forge_stone_t2';
UPDATE crafting_catalog SET craft_minutes = 90  WHERE id = 'forge_stone_t3';

-- ── Taller: Items de expedición ──────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 25  WHERE id = 'travel_ration';
UPDATE crafting_catalog SET craft_minutes = 35  WHERE id = 'explorer_map';
UPDATE crafting_catalog SET craft_minutes = 35  WHERE id = 'xp_seal';
UPDATE crafting_catalog SET craft_minutes = 45  WHERE id = 'loot_amulet';
UPDATE crafting_catalog SET craft_minutes = 60  WHERE id = 'enchanted_compass';
UPDATE crafting_catalog SET craft_minutes = 60  WHERE id = 'looter_eye';
UPDATE crafting_catalog SET craft_minutes = 75  WHERE id = 'explorer_talisman';
UPDATE crafting_catalog SET craft_minutes = 60  WHERE id = 'merchant_alchemy';

-- ── Taller: Escudos de Torre ─────────────────────────────────────────────────
UPDATE crafting_catalog SET craft_minutes = 45  WHERE id = 'tower_shield';
UPDATE crafting_catalog SET craft_minutes = 75  WHERE id = 'reinforced_shield';
