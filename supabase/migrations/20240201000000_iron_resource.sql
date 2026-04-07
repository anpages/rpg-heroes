-- Nuevo recurso: Hierro (producido por la Mina, antes producía Oro)
-- El Oro pasa a ser moneda de combate (sin producción pasiva)

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS iron      numeric(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iron_rate numeric(8,2) NOT NULL DEFAULT 0;

-- Quitar producción de oro para todos los jugadores
-- (El oro existente se conserva, solo se detiene la producción pasiva)
UPDATE resources SET gold_rate = 0;
