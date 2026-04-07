-- Salas de entrenamiento: timer de construcción/mejora
-- El laboratorio: siempre desbloqueado, empieza en nivel 0 (por construir)

-- Añadir timer de construcción a training_rooms
ALTER TABLE training_rooms
  ADD COLUMN IF NOT EXISTS building_ends_at timestamptz,
  ALTER COLUMN built_at DROP NOT NULL;

-- El lab ahora empieza en nivel 0 para nuevos jugadores.
-- Para jugadores existentes con lab ya construido (nivel 1+), no cambia nada.
-- Los que tengan lab bloqueado (unlocked=false) → se desbloquean y se ponen a nivel 0.
UPDATE buildings
SET unlocked = true, level = 0
WHERE type = 'laboratory' AND unlocked = false;
