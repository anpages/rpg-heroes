CREATE OR REPLACE FUNCTION dismantle_item_atomic(
  p_item_id   uuid,
  p_player_id uuid,
  p_gold      int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM inventory_items WHERE id = p_item_id;
  UPDATE resources SET gold = gold + p_gold WHERE player_id = p_player_id;
END;
$$;
