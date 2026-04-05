-- Añadir columna unlocked a buildings
ALTER TABLE public.buildings ADD COLUMN unlocked boolean NOT NULL DEFAULT false;

-- Cuartel, Mina de Oro y Nexo Arcano desbloqueados desde el inicio
UPDATE public.buildings SET unlocked = true WHERE type IN ('barracks', 'gold_mine', 'energy_nexus');

-- Desbloquear edificios para jugadores que ya han cumplido los requisitos

-- Taller: Cuartel >= 2
UPDATE public.buildings b SET unlocked = true
WHERE b.type = 'workshop'
  AND EXISTS (SELECT 1 FROM public.buildings b2 WHERE b2.player_id = b.player_id AND b2.type = 'barracks' AND b2.level >= 2);

-- Aserradero: Nexo Arcano >= 2
UPDATE public.buildings b SET unlocked = true
WHERE b.type = 'lumber_mill'
  AND EXISTS (SELECT 1 FROM public.buildings b2 WHERE b2.player_id = b.player_id AND b2.type = 'energy_nexus' AND b2.level >= 2);

-- Herrería + Pozo de Maná: Taller >= 2
UPDATE public.buildings b SET unlocked = true
WHERE b.type IN ('forge', 'mana_well')
  AND EXISTS (SELECT 1 FROM public.buildings b2 WHERE b2.player_id = b.player_id AND b2.type = 'workshop' AND b2.level >= 2);

-- Biblioteca: Mina de Oro >= 3
UPDATE public.buildings b SET unlocked = true
WHERE b.type = 'library'
  AND EXISTS (SELECT 1 FROM public.buildings b2 WHERE b2.player_id = b.player_id AND b2.type = 'gold_mine' AND b2.level >= 3);

-- Insertar forge y library para jugadores que no los tienen (onboarding antiguo no los creaba)
INSERT INTO public.buildings (player_id, type, unlocked)
SELECT p.id, b.type, false
FROM public.players p
CROSS JOIN (VALUES ('forge'), ('library')) AS b(type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.buildings bx WHERE bx.player_id = p.id AND bx.type = b.type
);
