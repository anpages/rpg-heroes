-- Atomic resource addition: avoids CAS conflicts when multiple
-- building-collect / collect-all calls race concurrently.
-- Uses SET col = col + N which is inherently atomic in Postgres.

CREATE OR REPLACE FUNCTION add_resources(
  p_player_id uuid,
  p_gold       int DEFAULT 0,
  p_iron       int DEFAULT 0,
  p_wood       int DEFAULT 0,
  p_mana       int DEFAULT 0,
  p_herbs      int DEFAULT 0,
  p_coal       int DEFAULT 0,
  p_fiber      int DEFAULT 0,
  p_arcane_dust int DEFAULT 0,
  p_flowers    int DEFAULT 0,
  p_fragments  int DEFAULT 0,
  p_essence    int DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE resources SET
    gold        = gold        + p_gold,
    iron        = iron        + p_iron,
    wood        = wood        + p_wood,
    mana        = mana        + p_mana,
    herbs       = herbs       + p_herbs,
    coal        = coal        + p_coal,
    fiber       = fiber       + p_fiber,
    arcane_dust = arcane_dust + p_arcane_dust,
    flowers     = flowers     + p_flowers,
    fragments   = fragments   + p_fragments,
    essence     = essence     + p_essence
  WHERE player_id = p_player_id;
$$;
