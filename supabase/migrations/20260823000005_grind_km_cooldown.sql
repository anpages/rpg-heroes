-- Cooldown del Momento clave en grindeo por héroe.
-- 0 = puede activarse. Cuando se activa se pone a 6 y decrementa 1 por combate.
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS grind_km_cooldown integer NOT NULL DEFAULT 0;
