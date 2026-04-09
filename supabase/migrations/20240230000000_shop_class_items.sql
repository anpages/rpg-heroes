-- Añadir items de clase (armas y armaduras) a la rotación de la tienda.
-- Solo tier 1-2, rareza common/uncommon/rare (misma política que la tienda original).
INSERT INTO shop_catalog (catalog_id, gold_price, daily_weight)
SELECT
  ic.id,
  CASE
    WHEN ic.rarity = 'common'   AND ic.tier = 1 THEN 500
    WHEN ic.rarity = 'uncommon' AND ic.tier = 1 THEN 1400
    WHEN ic.rarity = 'rare'     AND ic.tier = 1 THEN 3000
    WHEN ic.rarity = 'common'   AND ic.tier = 2 THEN 2000
    WHEN ic.rarity = 'uncommon' AND ic.tier = 2 THEN 5000
    WHEN ic.rarity = 'rare'     AND ic.tier = 2 THEN 10000
    ELSE 800
  END,
  CASE
    WHEN ic.rarity = 'common'   THEN 40
    WHEN ic.rarity = 'uncommon' THEN 30
    WHEN ic.rarity = 'rare'     THEN 15
    ELSE 25
  END
FROM item_catalog ic
WHERE ic.tier <= 2
  AND ic.rarity IN ('common', 'uncommon', 'rare')
  AND ic.required_class IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM shop_catalog sc WHERE sc.catalog_id = ic.id
  );
