-- Permite equipar/desequipar tácticas aunque el héroe esté en expedición
CREATE OR REPLACE FUNCTION equip_tactic(
  p_hero_id    UUID,
  p_tactic_id  UUID,
  p_slot_index INT,
  p_user_id    UUID,
  p_swap_cost  INT DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hero              RECORD;
  v_hero_tactic       RECORD;
  v_occupant_id       UUID;
  v_occupant_tactic_id UUID;
  v_is_swap           BOOLEAN;
  v_ok                BOOLEAN;
BEGIN
  SELECT id, status, class INTO v_hero
  FROM heroes
  WHERE id = p_hero_id AND player_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No autorizado');
  END IF;

  SELECT ht.id, ht.slot_index, ht.tactic_id, tc.required_class
  INTO v_hero_tactic
  FROM hero_tactics ht
  JOIN tactic_catalog tc ON tc.id = ht.tactic_id
  WHERE ht.hero_id = p_hero_id AND ht.tactic_id = p_tactic_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No tienes esta tactica en este heroe');
  END IF;

  IF v_hero_tactic.required_class IS NOT NULL AND v_hero_tactic.required_class != v_hero.class THEN
    RETURN jsonb_build_object('error', 'Esta tactica es exclusiva de otra clase');
  END IF;

  IF v_hero_tactic.slot_index IS NOT DISTINCT FROM p_slot_index THEN
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;

  v_is_swap := v_hero_tactic.slot_index IS NOT NULL AND p_slot_index IS NOT NULL;

  IF v_is_swap AND p_swap_cost > 0 THEN
    SELECT deduct_resources(p_user_id, p_swap_cost) INTO v_ok;
    IF NOT v_ok THEN
      RETURN jsonb_build_object('error', 'Oro insuficiente para cambiar de slot');
    END IF;
  END IF;

  v_occupant_id := NULL;
  v_occupant_tactic_id := NULL;

  IF p_slot_index IS NOT NULL THEN
    SELECT id, tactic_id INTO v_occupant_id, v_occupant_tactic_id
    FROM hero_tactics
    WHERE hero_id = p_hero_id
      AND slot_index = p_slot_index
      AND tactic_id != p_tactic_id
    LIMIT 1;

    IF v_occupant_id IS NOT NULL THEN
      UPDATE hero_tactics SET slot_index = NULL WHERE id = v_occupant_id;
    END IF;
  END IF;

  UPDATE hero_tactics SET slot_index = p_slot_index WHERE id = v_hero_tactic.id;

  RETURN jsonb_build_object(
    'ok',                   true,
    'changed',              true,
    'gold_spent',           CASE WHEN v_is_swap THEN p_swap_cost ELSE 0 END,
    'displaced_tactic_id',  v_occupant_tactic_id
  );
END;
$$;
