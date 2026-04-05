-- Actualizar valores por defecto de recursos iniciales
-- 200 oro y 120 madera para que el jugador pueda hacer 2-3 mejoras al inicio
-- 0 maná porque el Pozo de Maná se desbloquea en Taller lv.2 (mid-game)
-- wood_rate y mana_rate a 0 porque Aserradero y Pozo de Maná empiezan bloqueados
ALTER TABLE public.resources
  ALTER COLUMN gold      SET DEFAULT 200,
  ALTER COLUMN wood      SET DEFAULT 120,
  ALTER COLUMN mana      SET DEFAULT 0,
  ALTER COLUMN gold_rate SET DEFAULT 2,
  ALTER COLUMN wood_rate SET DEFAULT 0,
  ALTER COLUMN mana_rate SET DEFAULT 0;
