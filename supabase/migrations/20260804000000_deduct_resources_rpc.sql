-- Atomic resource deduction: uses SET col = col - N with a WHERE guard
-- to ensure all balances are sufficient. Returns TRUE if the deduction
-- succeeded, FALSE if any resource was insufficient (no partial writes).

CREATE OR REPLACE FUNCTION deduct_resources(
  p_player_id   uuid,
  p_gold        int DEFAULT 0,
  p_iron        int DEFAULT 0,
  p_wood        int DEFAULT 0,
  p_mana        int DEFAULT 0,
  p_herbs       int DEFAULT 0,
  p_coal        int DEFAULT 0,
  p_fiber       int DEFAULT 0,
  p_arcane_dust int DEFAULT 0,
  p_flowers     int DEFAULT 0,
  p_fragments   int DEFAULT 0,
  p_essence     int DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE resources SET
    gold        = gold        - p_gold,
    iron        = iron        - p_iron,
    wood        = wood        - p_wood,
    mana        = mana        - p_mana,
    herbs       = herbs       - p_herbs,
    coal        = coal        - p_coal,
    fiber       = fiber       - p_fiber,
    arcane_dust = arcane_dust - p_arcane_dust,
    flowers     = flowers     - p_flowers,
    fragments   = fragments   - p_fragments,
    essence     = essence     - p_essence
  WHERE player_id = p_player_id
    AND gold        >= p_gold
    AND iron        >= p_iron
    AND wood        >= p_wood
    AND mana        >= p_mana
    AND herbs       >= p_herbs
    AND coal        >= p_coal
    AND fiber       >= p_fiber
    AND arcane_dust >= p_arcane_dust
    AND flowers     >= p_flowers
    AND fragments   >= p_fragments
    AND essence     >= p_essence;

  RETURN FOUND;
END;
$$;
