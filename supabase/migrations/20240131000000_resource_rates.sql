-- Reducir tasas de recursos: columnas a numeric para soportar valores fraccionarios
-- y reset a valores mucho más bajos

ALTER TABLE resources
  ALTER COLUMN gold_rate TYPE numeric(8,2) USING gold_rate::numeric,
  ALTER COLUMN wood_rate TYPE numeric(8,2) USING wood_rate::numeric,
  ALTER COLUMN mana_rate TYPE numeric(8,2) USING mana_rate::numeric;

-- Reset tasas al mínimo nuevo (se recalcularán al mejorar cualquier edificio)
-- Solo afecta a jugadores que ya tienen producción activa
UPDATE resources
SET
  gold_rate = CASE WHEN gold_rate > 0 THEN 0.5 ELSE 0 END,
  wood_rate = CASE WHEN wood_rate > 0 THEN 0.3 ELSE 0 END,
  mana_rate = CASE WHEN mana_rate > 0 THEN 0.2 ELSE 0 END;
