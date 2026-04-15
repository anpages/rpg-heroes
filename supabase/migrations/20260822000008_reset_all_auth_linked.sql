-- Reset completo de todas las tablas que referencian auth.users directamente
-- (no se limpian con TRUNCATE players CASCADE)
TRUNCATE
  public.training_rooms,
  public.player_research,
  public.player_potions,
  public.player_potion_crafting,
  public.team_combats,
  public.player_crafting_queue
CASCADE;
