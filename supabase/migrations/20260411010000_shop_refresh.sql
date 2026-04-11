-- Contador de refresh manual de la tienda, por héroe y día.
-- Se usa como parte de la semilla determinista de shop-daily para rotar
-- la oferta sin necesidad de persistir la rotación en sí.

CREATE TABLE IF NOT EXISTS hero_shop_refreshes (
  hero_id       uuid        NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  refresh_date  date        NOT NULL,
  refresh_count int         NOT NULL DEFAULT 0 CHECK (refresh_count >= 0),
  PRIMARY KEY (hero_id, refresh_date)
);

ALTER TABLE hero_shop_refreshes ENABLE ROW LEVEL SECURITY;

-- Lectura: el dueño del héroe
CREATE POLICY "hero_shop_refreshes_own_read"
  ON hero_shop_refreshes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM heroes h
      WHERE h.id = hero_shop_refreshes.hero_id
        AND h.player_id = auth.uid()
    )
  );

-- Escritura solo service_role (backend). Sin policy de INSERT/UPDATE.
