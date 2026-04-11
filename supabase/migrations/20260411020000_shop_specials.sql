-- Catálogo de ofertas especiales: 2 slots rotativos en la tienda diaria.
-- Son consumibles con efectos directos (XP, reparación, heal, cofre…), no
-- equipables. La rotación sigue la misma semilla determinista de shop-daily.

CREATE TABLE IF NOT EXISTS shop_special_catalog (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  description   text NOT NULL,
  gold_price    int  NOT NULL CHECK (gold_price > 0),
  effect_type   text NOT NULL,
  effect_value  int  NOT NULL DEFAULT 0,
  icon          text,
  weight        int  NOT NULL DEFAULT 1
);

ALTER TABLE shop_special_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_special_catalog_read"
  ON shop_special_catalog FOR SELECT
  USING (auth.role() = 'authenticated');

-- Semilla inicial: 5 ofertas
INSERT INTO shop_special_catalog (id, name, description, gold_price, effect_type, effect_value, icon) VALUES
  ('xp_scroll',      'Pergamino de Experiencia', 'Otorga 500 puntos de experiencia al héroe inmediatamente.',   1200, 'xp_scroll',      500,  'book-open'),
  ('repair_all',     'Elixir de Reparación',     'Repara toda la durabilidad del equipamiento equipado.',       800,  'repair_all',     0,    'wrench'),
  ('double_loot',    'Pergamino del Doble Botín','La próxima expedición tiene el doble de probabilidad de drop.', 1500, 'double_loot',    1,    'sparkles'),
  ('full_heal',      'Poción Premium de Vida',   'Cura al héroe al 100% de forma instantánea.',                 400,  'full_heal',      0,    'heart'),
  ('merchant_chest', 'Cofre del Mercader',       'Item aleatorio de rareza rare o epic del tier del héroe.',    3000, 'merchant_chest', 0,    'package')
ON CONFLICT (id) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  gold_price   = EXCLUDED.gold_price,
  effect_type  = EXCLUDED.effect_type,
  effect_value = EXCLUDED.effect_value,
  icon         = EXCLUDED.icon;
