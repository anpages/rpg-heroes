-- Reset completo de datos de jugadores
-- Mantiene: catálogos, dungeons, tactic_catalog, item_catalog, research_nodes, classes
-- Elimina: players (en cascada elimina resources, buildings, heroes, inventory, tactics, expeditions, battles, training, research, tower, torneos, shop)

TRUNCATE public.players CASCADE;
