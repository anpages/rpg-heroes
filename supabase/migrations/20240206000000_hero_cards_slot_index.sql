-- Reemplaza el campo booleano `equipped` por `slot_index` (0-4, null = sin equipar).
-- Permite hasta 5 slots con posición explícita, necesario para Cards v2.

ALTER TABLE hero_cards
  ADD COLUMN slot_index integer CHECK (slot_index BETWEEN 0 AND 4);

-- Migrar cartas ya equipadas al slot 0
UPDATE hero_cards SET slot_index = 0 WHERE equipped = true;

ALTER TABLE hero_cards DROP COLUMN equipped;
