-- Rebalance potion and rune crafting costs
-- Potions were too cheap relative to passive mana production
-- Runes were too cheap relative to fragment/essence drop rates (~1-2 per dungeon run)

-- Potions
UPDATE potion_catalog SET recipe_gold = 150, recipe_mana = 80                           WHERE effect_type = 'hp_minor';
UPDATE potion_catalog SET recipe_gold = 350, recipe_mana = 200, recipe_fragments = 3    WHERE effect_type = 'hp_major';
UPDATE potion_catalog SET recipe_gold = 250, recipe_mana = 120, recipe_fragments = 2    WHERE effect_type = 'power';
UPDATE potion_catalog SET recipe_gold = 250, recipe_mana = 120, recipe_fragments = 2    WHERE effect_type = 'shield';
UPDATE potion_catalog SET recipe_gold = 200, recipe_mana = 150, recipe_fragments = 2    WHERE effect_type = 'wisdom';

-- Runes (basic: 10 fragments + 5 essence; Runa de Luz: 18 + 10)
UPDATE rune_catalog SET recipe_fragments = 10, recipe_essence = 5  WHERE name IN ('Runa de Fuego', 'Runa de Hielo', 'Runa de Tormenta', 'Runa de Viento', 'Runa de Tierra');
UPDATE rune_catalog SET recipe_fragments = 18, recipe_essence = 10 WHERE name = 'Runa de Luz';
