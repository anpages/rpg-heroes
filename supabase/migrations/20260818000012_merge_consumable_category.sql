-- Fusiona categorías potion y expedition en consumable
UPDATE crafting_catalog
SET category = 'consumable'
WHERE category IN ('potion', 'expedition');
