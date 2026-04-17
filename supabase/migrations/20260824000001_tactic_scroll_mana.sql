-- Subir coste de maná del pergamino táctico de 30 a 50
UPDATE crafting_catalog SET
  inputs = '[{"resource":"mana","qty":50},{"resource":"fragments","qty":5}]'::jsonb
WHERE id = 'tactic_scroll';
