-- Reset de tablas que referencian auth.users directamente (se saltaron el CASCADE anterior)
TRUNCATE
  training_rooms,
  player_research,
  player_potions,
  player_potion_crafting,
  player_crafted_items,
  player_crafting_queue,
  team_combats
CASCADE;
