-- Añadir slot a heroes para soportar múltiples héroes por jugador
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS slot integer NOT NULL DEFAULT 1;

-- Héroe existente → slot 1
UPDATE heroes SET slot = 1 WHERE slot IS NULL OR slot = 0;

-- Un jugador no puede tener dos héroes en el mismo slot
ALTER TABLE heroes ADD CONSTRAINT heroes_player_slot_unique UNIQUE (player_id, slot);
