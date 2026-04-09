-- Las pociones solo deben usar oro y maná, no madera.
-- Convertimos recipe_wood a recipe_mana equivalente.

UPDATE potion_catalog SET recipe_wood = 0, recipe_mana = 20 WHERE id = 'hp_minor';
UPDATE potion_catalog SET recipe_wood = 0, recipe_mana = 70 WHERE id = 'hp_major';
UPDATE potion_catalog SET recipe_wood = 0, recipe_mana = 60 WHERE id = 'wisdom';
