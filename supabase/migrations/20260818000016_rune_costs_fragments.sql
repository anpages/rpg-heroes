-- Las runas dan bonos permanentes a ítems equipados — deben costar fragmentos
-- y esencia para reflejar su valor. Mantiene los recursos brutos base.

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":15},{"resource":"mana","qty":5},{"resource":"fragments","qty":3}]'::jsonb
WHERE id = 'rune_attack';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":15},{"resource":"wood","qty":5},{"resource":"fragments","qty":3}]'::jsonb
WHERE id = 'rune_defense';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"wood","qty":10},{"resource":"herbs","qty":10},{"resource":"fragments","qty":4}]'::jsonb
WHERE id = 'rune_hp';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":12},{"resource":"herbs","qty":8},{"resource":"fragments","qty":3}]'::jsonb
WHERE id = 'rune_strength';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"wood","qty":8},{"resource":"mana","qty":8},{"resource":"fragments","qty":3}]'::jsonb
WHERE id = 'rune_agility';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"mana","qty":12},{"resource":"herbs","qty":8},{"resource":"fragments","qty":4},{"resource":"essence","qty":1}]'::jsonb
WHERE id = 'rune_intelligence';
