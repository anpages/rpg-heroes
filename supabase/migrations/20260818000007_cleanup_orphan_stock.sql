-- Limpia stock huérfano: items en player_crafted_items cuya receta
-- ya no existe en crafting_catalog (fue eliminada en el rediseño).
DELETE FROM player_crafted_items
WHERE recipe_id NOT IN (SELECT id FROM crafting_catalog);

-- Por si acaso también limpia slots de refinado huérfanos
-- (aunque tienen FK, por seguridad)
DELETE FROM player_refining_slots
WHERE recipe_id NOT IN (SELECT id FROM crafting_catalog);
