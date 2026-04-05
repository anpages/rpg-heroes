-- Rebalanceo de precios de tienda: precios altos para que comprar duela
UPDATE shop_catalog sc
SET gold_price = CASE
  WHEN ic.rarity = 'common'   AND ic.tier = 1 THEN 500
  WHEN ic.rarity = 'uncommon' AND ic.tier = 1 THEN 1400
  WHEN ic.rarity = 'rare'     AND ic.tier = 1 THEN 3000
  WHEN ic.rarity = 'common'   AND ic.tier = 2 THEN 2000
  WHEN ic.rarity = 'uncommon' AND ic.tier = 2 THEN 5000
  WHEN ic.rarity = 'rare'     AND ic.tier = 2 THEN 10000
  ELSE 800
END
FROM item_catalog ic
WHERE sc.catalog_id = ic.id;
