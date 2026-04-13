-- Elimina slots de crafteo huérfanos (receta eliminada del catálogo)
DELETE FROM player_refining_slots
WHERE recipe_id NOT IN (SELECT id FROM crafting_catalog);

DELETE FROM player_crafting_queue
WHERE recipe_id NOT IN (SELECT id FROM crafting_catalog);
