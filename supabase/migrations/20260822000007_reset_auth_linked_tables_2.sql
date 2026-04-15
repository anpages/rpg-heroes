-- Reset de tablas que referencian auth.users directamente
-- (no se borran en cascada con TRUNCATE players CASCADE)
TRUNCATE
  public.player_crafted_items,
  public.player_refining_slots
CASCADE;
