CREATE OR REPLACE FUNCTION collect_craft_queue_atomic(
  p_player_id uuid,
  p_craft_id  uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_craft record;
  v_recipe record;
  v_output_qty int;
  v_new_qty int;
BEGIN
  SELECT * INTO v_craft FROM player_crafting_queue
  WHERE id = p_craft_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Craft no encontrado'; END IF;
  IF v_craft.player_id != p_player_id THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF v_craft.craft_ends_at > clock_timestamp() THEN
    RAISE EXCEPTION 'El crafteo aún no ha terminado';
  END IF;

  SELECT output_qty, name INTO v_recipe FROM crafting_catalog WHERE id = v_craft.recipe_id;
  v_output_qty := COALESCE(v_recipe.output_qty, 1);

  INSERT INTO player_crafted_items (player_id, recipe_id, quantity)
  VALUES (p_player_id, v_craft.recipe_id, v_output_qty)
  ON CONFLICT (player_id, recipe_id)
  DO UPDATE SET quantity = player_crafted_items.quantity + v_output_qty;

  SELECT quantity INTO v_new_qty FROM player_crafted_items
  WHERE player_id = p_player_id AND recipe_id = v_craft.recipe_id;

  DELETE FROM player_crafting_queue WHERE id = p_craft_id;

  RETURN jsonb_build_object(
    'ok', true,
    'item', v_craft.recipe_id,
    'name', COALESCE(v_recipe.name, v_craft.recipe_id),
    'quantity', v_new_qty
  );
END;
$$;
