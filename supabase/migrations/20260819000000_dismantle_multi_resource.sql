CREATE OR REPLACE FUNCTION dismantle_item_atomic(
  p_item_id   uuid,
  p_player_id uuid,
  p_gold      int,
  p_mana      int DEFAULT 0,
  p_fragments int DEFAULT 0,
  p_essence   int DEFAULT 0
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM inventory_items WHERE id = p_item_id;
  UPDATE resources
  SET
    gold      = gold      + p_gold,
    mana      = mana      + p_mana,
    fragments = fragments + p_fragments,
    essence   = essence   + p_essence
  WHERE player_id = p_player_id;
END;
$$;
