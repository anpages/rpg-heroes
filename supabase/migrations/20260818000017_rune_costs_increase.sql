-- Runas cuestan demasiado poco — se suben los materiales brutos a ~3-4x
-- para que representen varios ciclos de producción de edificios.

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":50},{"resource":"mana","qty":20},{"resource":"fragments","qty":4}]'::jsonb
WHERE id = 'rune_attack';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":50},{"resource":"wood","qty":20},{"resource":"fragments","qty":4}]'::jsonb
WHERE id = 'rune_defense';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"wood","qty":40},{"resource":"herbs","qty":35},{"resource":"fragments","qty":5}]'::jsonb
WHERE id = 'rune_hp';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":40},{"resource":"herbs","qty":30},{"resource":"fragments","qty":4}]'::jsonb
WHERE id = 'rune_strength';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"wood","qty":30},{"resource":"mana","qty":30},{"resource":"fragments","qty":4}]'::jsonb
WHERE id = 'rune_agility';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"mana","qty":45},{"resource":"herbs","qty":30},{"resource":"fragments","qty":5},{"resource":"essence","qty":2}]'::jsonb
WHERE id = 'rune_intelligence';
