-- Balance de maná: añadir coste de maná a runas T1 que no lo tenían,
-- y subir el coste del pergamino táctico.

-- rune_defense: añadir 20 mana (manteniendo iron + wood)
UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":50},{"resource":"wood","qty":20},{"resource":"mana","qty":20},{"resource":"fragments","qty":4}]'::jsonb
WHERE id = 'rune_defense';

-- rune_hp: añadir 20 mana (manteniendo wood + herbs)
UPDATE crafting_catalog SET
  inputs = '[{"resource":"wood","qty":40},{"resource":"herbs","qty":35},{"resource":"mana","qty":20},{"resource":"fragments","qty":5}]'::jsonb
WHERE id = 'rune_hp';

-- rune_strength: añadir 20 mana (manteniendo iron + herbs)
UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":40},{"resource":"herbs","qty":30},{"resource":"mana","qty":20},{"resource":"fragments","qty":4}]'::jsonb
WHERE id = 'rune_strength';

-- Pergamino táctico: subir mana de 20 a 30
UPDATE crafting_catalog SET
  inputs = '[{"resource":"mana","qty":30},{"resource":"fragments","qty":5}]'::jsonb
WHERE id = 'tactic_scroll';
