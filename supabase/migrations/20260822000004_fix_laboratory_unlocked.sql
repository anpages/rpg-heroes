-- Fix: laboratory debe estar siempre desbloqueado desde el inicio.
-- Se perdió porque laboratory fue eliminado de ALL_BUILDING_TYPES cuando
-- se reorganizó BASE_BUILDING_TYPES.

UPDATE buildings
SET unlocked = true
WHERE type = 'laboratory';
