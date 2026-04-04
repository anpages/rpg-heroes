-- Añadir Nexo Arcano a todos los jugadores existentes
INSERT INTO public.buildings (player_id, type, level)
SELECT p.id, 'energy_nexus', 1
FROM public.players p
WHERE NOT EXISTS (
  SELECT 1 FROM public.buildings b
  WHERE b.player_id = p.id AND b.type = 'energy_nexus'
);
