-- ══════════════════════════════════════════════════════════════════════════════
-- Rediseño del sistema de crafteo:
--   · Elimina pociones, repair kits, boosts de expedición, tower shields
--   · Elimina materiales refinados T2-T5 (demasiada complejidad intermedia)
--   · Añade runas de encantamiento permanente para ítems de equipo
--   · Añade provisiones de expedición (auto-consume al iniciar, +15% oro +10% XP)
--   · Forge stones actualizados a ingredientes T1
--   · Añade columna enchantments a inventory_items
--   · Reparación pasa a costar oro (sin item intermedio)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Limpiar slots de refinado con recetas obsoletas
--    (hay FK a crafting_catalog, hay que borrar primero)
DELETE FROM player_refining_slots
WHERE recipe_id IN (
  'hp_potion_minor','hp_potion_major','atk_elixir','def_elixir',
  'repair_kit','repair_kit_full',
  'travel_ration','explorer_map','xp_seal','loot_amulet',
  'enchanted_compass','looter_eye','explorer_talisman','merchant_alchemy',
  'tower_shield','reinforced_shield',
  'tempered_steel','composite_wood','concentrated_mana','potion_base',
  'reinforced_frame','armor_plate','arcane_prism','concentrated_elixir',
  'master_beam','steel_gear','mana_lens','essential_oil',
  'assembled_panel','forged_steel','arcane_condenser','cataplasm'
);

-- 2. Limpiar cola de crafteo vieja si existe
DELETE FROM player_crafting_queue
WHERE recipe_id IN (
  'hp_potion_minor','hp_potion_major','atk_elixir','def_elixir',
  'repair_kit','repair_kit_full',
  'travel_ration','explorer_map','xp_seal','loot_amulet',
  'enchanted_compass','looter_eye','explorer_talisman','merchant_alchemy',
  'tower_shield','reinforced_shield',
  'tempered_steel','composite_wood','concentrated_mana','potion_base',
  'reinforced_frame','armor_plate','arcane_prism','concentrated_elixir',
  'master_beam','steel_gear','mana_lens','essential_oil',
  'assembled_panel','forged_steel','arcane_condenser','cataplasm'
);

-- 3. Limpiar inventario crafteable obsoleto
DELETE FROM player_crafted_items
WHERE recipe_id IN (
  'hp_potion_minor','hp_potion_major','atk_elixir','def_elixir',
  'repair_kit','repair_kit_full',
  'travel_ration','explorer_map','xp_seal','loot_amulet',
  'enchanted_compass','looter_eye','explorer_talisman','merchant_alchemy',
  'tower_shield','reinforced_shield',
  'tempered_steel','composite_wood','concentrated_mana','potion_base',
  'reinforced_frame','armor_plate','arcane_prism','concentrated_elixir',
  'master_beam','steel_gear','mana_lens','essential_oil',
  'assembled_panel','forged_steel','arcane_condenser','cataplasm'
);

-- 4. Eliminar recetas obsoletas del catálogo
DELETE FROM crafting_catalog
WHERE id IN (
  'hp_potion_minor','hp_potion_major','atk_elixir','def_elixir',
  'repair_kit','repair_kit_full',
  'travel_ration','explorer_map','xp_seal','loot_amulet',
  'enchanted_compass','looter_eye','explorer_talisman','merchant_alchemy',
  'tower_shield','reinforced_shield',
  'tempered_steel','composite_wood','concentrated_mana','potion_base',
  'reinforced_frame','armor_plate','arcane_prism','concentrated_elixir',
  'master_beam','steel_gear','mana_lens','essential_oil',
  'assembled_panel','forged_steel','arcane_condenser','cataplasm'
);

-- 5. Actualizar forge stones a ingredientes T1
UPDATE crafting_catalog SET
  inputs = '[{"item":"steel_ingot","qty":4},{"item":"plank","qty":2},{"resource":"fragments","qty":2}]'::jsonb,
  craft_minutes = 20
WHERE id = 'forge_stone_t2';

UPDATE crafting_catalog SET
  inputs = '[{"item":"steel_ingot","qty":6},{"item":"plank","qty":4},{"item":"mana_crystal","qty":2},{"resource":"essence","qty":4}]'::jsonb,
  craft_minutes = 30
WHERE id = 'forge_stone_t3';

-- 6. Insertar nuevas recetas: runas de encantamiento + provisiones
INSERT INTO crafting_catalog
  (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  (
    'rune_attack',
    'Runa de Ataque',
    'Aplica +10 de ataque permanente a un ítem de equipo.',
    'rune', '⚔️',
    '[{"item":"steel_ingot","qty":3},{"item":"mana_crystal","qty":2}]'::jsonb,
    1, 15, 1, 'laboratory', 0,
    '[{"type":"enchant","stat":"attack_bonus","value":10}]'::jsonb
  ),
  (
    'rune_defense',
    'Runa de Defensa',
    'Aplica +10 de defensa permanente a un ítem de equipo.',
    'rune', '🛡️',
    '[{"item":"steel_ingot","qty":2},{"item":"plank","qty":3}]'::jsonb,
    1, 15, 1, 'laboratory', 0,
    '[{"type":"enchant","stat":"defense_bonus","value":10}]'::jsonb
  ),
  (
    'rune_hp',
    'Runa de Vida',
    'Aplica +80 de HP máximo permanente a un ítem de equipo.',
    'rune', '💚',
    '[{"item":"plank","qty":2},{"item":"herbal_extract","qty":3}]'::jsonb,
    1, 15, 1, 'laboratory', 0,
    '[{"type":"enchant","stat":"hp_bonus","value":80}]'::jsonb
  ),
  (
    'expedition_provisions',
    'Provisiones',
    '+15% oro y +10% XP en la siguiente expedición. Se consume al iniciar.',
    'expedition', '🎒',
    '[{"item":"plank","qty":3},{"item":"herbal_extract","qty":3}]'::jsonb,
    3, 20, 1, 'laboratory', 0,
    '[{"type":"expedition_bonus","gold_pct":0.15,"xp_pct":0.10}]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  inputs = EXCLUDED.inputs,
  output_qty = EXCLUDED.output_qty,
  craft_minutes = EXCLUDED.craft_minutes,
  effects = EXCLUDED.effects;

-- 7. Añadir columna enchantments a inventory_items
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS enchantments jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 8. Limpiar efectos activos de pociones en héroes (por si quedaron activos)
UPDATE heroes SET active_effects = (
  active_effects
  - 'hp_cost_reduction'
  - 'time_reduction'
  - 'atk_boost'
  - 'def_boost'
  - 'xp_boost'
  - 'loot_boost'
  - 'gold_boost'
  - 'tower_shield'
)
WHERE active_effects IS NOT NULL
  AND active_effects != '{}'::jsonb;
