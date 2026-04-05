-- Catálogo de items disponibles en la tienda NPC
CREATE TABLE IF NOT EXISTS shop_catalog (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id   uuid NOT NULL REFERENCES item_catalog(id) ON DELETE CASCADE,
  gold_price   integer NOT NULL,
  daily_weight integer NOT NULL DEFAULT 30
);

-- Poblar con items tier 1-2 de rareza common/uncommon/rare
-- Precios altos para que la tienda compita con expediciones (no las sustituya)
INSERT INTO shop_catalog (catalog_id, gold_price, daily_weight)
SELECT
  id,
  CASE
    WHEN rarity = 'common'   AND tier = 1 THEN 500
    WHEN rarity = 'uncommon' AND tier = 1 THEN 1400
    WHEN rarity = 'rare'     AND tier = 1 THEN 3000
    WHEN rarity = 'common'   AND tier = 2 THEN 2000
    WHEN rarity = 'uncommon' AND tier = 2 THEN 5000
    WHEN rarity = 'rare'     AND tier = 2 THEN 10000
    ELSE 800
  END,
  CASE
    WHEN rarity = 'common'   THEN 40
    WHEN rarity = 'uncommon' THEN 30
    WHEN rarity = 'rare'     THEN 15
    ELSE 25
  END
FROM item_catalog
WHERE tier <= 2 AND rarity IN ('common', 'uncommon', 'rare');

-- Registro de compras por héroe y fecha (stock diario)
CREATE TABLE IF NOT EXISTS shop_purchases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id       uuid NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  catalog_id    uuid NOT NULL REFERENCES item_catalog(id),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  quantity      integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_purchases_hero_catalog_date
  ON shop_purchases(hero_id, catalog_id, purchase_date);

-- RLS
ALTER TABLE shop_catalog   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_catalog_public_read" ON shop_catalog
  FOR SELECT USING (true);

CREATE POLICY "shop_purchases_own_read" ON shop_purchases
  FOR SELECT USING (hero_id IN (SELECT id FROM heroes WHERE player_id = auth.uid()));

CREATE POLICY "shop_purchases_own_insert" ON shop_purchases
  FOR INSERT WITH CHECK (hero_id IN (SELECT id FROM heroes WHERE player_id = auth.uid()));

CREATE POLICY "shop_purchases_own_update" ON shop_purchases
  FOR UPDATE USING (hero_id IN (SELECT id FROM heroes WHERE player_id = auth.uid()));
