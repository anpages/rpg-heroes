-- La migración 20240115 añadió UNIQUE(player_id, slot) para soportar múltiples
-- héroes por jugador, pero no eliminó el constraint antiguo UNIQUE(player_id).
-- Ese constraint sigue impidiendo crear un segundo héroe.
ALTER TABLE public.heroes DROP CONSTRAINT IF EXISTS heroes_player_id_key;
