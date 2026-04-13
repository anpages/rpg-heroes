CREATE OR REPLACE FUNCTION claim_mission_atomic(
  p_player_id  uuid,
  p_hero_id    uuid,
  p_mission_id uuid,
  p_gold       int,
  p_xp         int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hero record;
  v_new_xp int;
  v_new_level int;
  v_level_up boolean := false;
  v_xp_req int;
BEGIN
  SELECT experience, level INTO v_hero FROM heroes
  WHERE id = p_hero_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Héroe no encontrado'; END IF;

  UPDATE resources SET gold = gold + p_gold WHERE player_id = p_player_id;

  v_new_xp := v_hero.experience + p_xp;
  v_new_level := v_hero.level;
  v_xp_req := xp_for_level(v_new_level);

  WHILE v_new_xp >= v_xp_req LOOP
    v_new_xp := v_new_xp - v_xp_req;
    v_new_level := v_new_level + 1;
    v_level_up := true;
    v_xp_req := xp_for_level(v_new_level);
  END LOOP;

  UPDATE heroes SET experience = v_new_xp, level = v_new_level
  WHERE id = p_hero_id;

  UPDATE daily_missions SET claimed = true WHERE id = p_mission_id;

  RETURN jsonb_build_object('level_up', v_level_up);
END;
$$;
