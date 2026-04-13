CREATE OR REPLACE FUNCTION collect_potion_atomic(
  p_player_id uuid,
  p_craft_id  uuid,
  p_max_stack int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_craft record;
  v_current_qty int;
  v_new_qty int;
BEGIN
  SELECT * INTO v_craft FROM player_potion_crafting
  WHERE id = p_craft_id AND player_id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Crafteo no encontrado'; END IF;
  IF v_craft.craft_ends_at > clock_timestamp() THEN
    RAISE EXCEPTION 'La poción aún no está lista';
  END IF;

  SELECT COALESCE(quantity, 0) INTO v_current_qty FROM player_potions
  WHERE player_id = p_player_id AND potion_id = v_craft.potion_id;
  v_current_qty := COALESCE(v_current_qty, 0);

  IF v_current_qty >= p_max_stack THEN
    RAISE EXCEPTION 'Ya tienes el máximo (%) de esta poción', p_max_stack;
  END IF;

  v_new_qty := v_current_qty + 1;

  INSERT INTO player_potions (player_id, potion_id, quantity)
  VALUES (p_player_id, v_craft.potion_id, 1)
  ON CONFLICT (player_id, potion_id)
  DO UPDATE SET quantity = player_potions.quantity + 1;

  DELETE FROM player_potion_crafting WHERE id = p_craft_id;

  RETURN jsonb_build_object('ok', true, 'potion_id', v_craft.potion_id, 'quantity', v_new_qty);
END;
$$;
