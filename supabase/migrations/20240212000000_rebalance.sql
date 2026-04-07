-- Base v2 Fase 4: Rebalanceo — forge y library integrados en el árbol de progresión

-- 1. Crear forge y library para jugadores que no los tienen todavía
INSERT INTO public.buildings (player_id, type, level, unlocked)
SELECT p.id, b.type, 0, false
FROM public.players p
CROSS JOIN (VALUES ('forge'), ('library')) AS b(type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.buildings bx WHERE bx.player_id = p.id AND bx.type = b.type
);

-- 2. Forge: se desbloquea cuando el laboratorio alcanza Nv.1
--    (antes dependía de "workshop >= 2", que ya no existe)
UPDATE public.buildings b SET unlocked = true
WHERE b.type = 'forge'
  AND b.unlocked = false
  AND EXISTS (
    SELECT 1 FROM public.buildings b2
    WHERE b2.player_id = b.player_id AND b2.type = 'laboratory' AND b2.level >= 1
  );

-- 3. Library: se desbloquea cuando el laboratorio alcanza Nv.2
UPDATE public.buildings b SET unlocked = true
WHERE b.type = 'library'
  AND b.unlocked = false
  AND EXISTS (
    SELECT 1 FROM public.buildings b2
    WHERE b2.player_id = b.player_id AND b2.type = 'laboratory' AND b2.level >= 2
  );
