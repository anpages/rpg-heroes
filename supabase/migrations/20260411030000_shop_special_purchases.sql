-- Registro de compras de ofertas especiales (una por héroe por día por special).
-- Usamos special_id text para emparejar con shop_special_catalog.

CREATE TABLE IF NOT EXISTS hero_shop_special_purchases (
  hero_id       uuid NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  special_id    text NOT NULL,
  purchase_date date NOT NULL,
  PRIMARY KEY (hero_id, special_id, purchase_date)
);

ALTER TABLE hero_shop_special_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hero_shop_special_purchases_own_read"
  ON hero_shop_special_purchases FOR SELECT
  USING (EXISTS (SELECT 1 FROM heroes h WHERE h.id = hero_shop_special_purchases.hero_id AND h.player_id = auth.uid()));
