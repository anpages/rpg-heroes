CREATE OR REPLACE FUNCTION complete_expedition_atomic(
  p_player_id      uuid,
  p_hero_id        uuid,
  p_expedition_id  uuid,
  p_gold           int,
  p_xp             int,
  p_fragments      int DEFAULT 0,
  p_essence        int DEFAULT 0,
  p_effects        jsonb DEFAULT '{}'::jsonb,
  p_hp             int DEFAULT NULL,
  p_hp_updated_at  timestamptz DEFAULT NULL
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

  UPDATE resources SET
    gold      = gold      + p_gold,
    fragments = fragments + p_fragments,
    essence   = essence   + p_essence
  WHERE player_id = p_player_id;

  v_new_xp := v_hero.experience + p_xp;
  v_new_level := v_hero.level;
  v_xp_req := xp_for_level(v_new_level);

  WHILE v_new_xp >= v_xp_req LOOP
    v_new_xp := v_new_xp - v_xp_req;
    v_new_level := v_new_level + 1;
    v_level_up := true;
    v_xp_req := xp_for_level(v_new_level);
  END LOOP;

  UPDATE heroes SET
    status             = 'idle',
    experience         = v_new_xp,
    level              = v_new_level,
    active_effects     = p_effects,
    current_hp         = COALESCE(p_hp, current_hp),
    hp_last_updated_at = COALESCE(p_hp_updated_at, hp_last_updated_at),
    status_ends_at     = NULL
  WHERE id = p_hero_id;

  UPDATE expeditions
  SET status = 'completed', completed_at = clock_timestamp()
  WHERE id = p_expedition_id;

  RETURN jsonb_build_object('level_up', v_level_up, 'new_level', v_new_level);
END;
$$;
