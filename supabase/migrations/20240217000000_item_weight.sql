-- Añade peso a los items del catálogo.
-- El peso penaliza la agilidad del héroe: floor(peso_total_equipado / 4)
-- Valores por slot (independiente del tier):
--   helmet: 2, chest: 5, arms: 2, legs: 3
--   main_hand 1h: 3, main_hand 2h: 6, off_hand: 2, accessory: 1

ALTER TABLE item_catalog ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 0;

UPDATE item_catalog SET weight = CASE slot
  WHEN 'helmet'    THEN 2
  WHEN 'chest'     THEN 5
  WHEN 'arms'      THEN 2
  WHEN 'legs'      THEN 3
  WHEN 'main_hand' THEN CASE WHEN is_two_handed THEN 6 ELSE 3 END
  WHEN 'off_hand'  THEN 2
  WHEN 'accessory' THEN 1
  ELSE 1
END;
