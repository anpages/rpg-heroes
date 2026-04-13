CREATE OR REPLACE FUNCTION collect_refining_atomic(
  p_player_id uuid,
  p_slot_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot record;
  v_recipe record;
  v_elapsed_ms bigint;
  v_completed int;
  v_total_output int;
  v_remaining int;
  v_new_started_at timestamptz;
BEGIN
  SELECT * INTO v_slot FROM player_refining_slots
  WHERE id = p_slot_id AND player_id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Slot no encontrado'; END IF;

  v_elapsed_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_slot.craft_started_at))::bigint * 1000;
  v_completed := LEAST(v_slot.quantity, floor(v_elapsed_ms::numeric / v_slot.unit_duration_ms)::int);

  IF v_completed <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'collected', 0);
  END IF;

  SELECT output_qty, name INTO v_recipe FROM crafting_catalog WHERE id = v_slot.recipe_id;

  v_total_output := v_completed * COALESCE(v_recipe.output_qty, 1);

  INSERT INTO player_crafted_items (player_id, recipe_id, quantity)
  VALUES (p_player_id, v_slot.recipe_id, v_total_output)
  ON CONFLICT (player_id, recipe_id)
  DO UPDATE SET quantity = player_crafted_items.quantity + v_total_output;

  v_remaining := v_slot.quantity - v_completed;
  IF v_remaining <= 0 THEN
    DELETE FROM player_refining_slots WHERE id = v_slot.id;
  ELSE
    v_new_started_at := v_slot.craft_started_at + make_interval(secs => (v_completed * v_slot.unit_duration_ms)::numeric / 1000.0);
    UPDATE player_refining_slots
    SET quantity = v_remaining, craft_started_at = v_new_started_at
    WHERE id = v_slot.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'collected', v_total_output,
    'item', v_slot.recipe_id,
    'name', COALESCE(v_recipe.name, v_slot.recipe_id)
  );
END;
$$;
