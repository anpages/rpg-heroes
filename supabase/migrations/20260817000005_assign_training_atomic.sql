CREATE OR REPLACE FUNCTION assign_training_atomic(
  p_player_id uuid,
  p_hero_id   uuid,
  p_stat      text,
  p_amount    int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token record;
  v_hero_val int;
BEGIN
  SELECT quantity INTO v_token FROM player_training_tokens
  WHERE player_id = p_player_id AND stat = p_stat
  FOR UPDATE;

  IF NOT FOUND OR v_token.quantity < p_amount THEN
    RAISE EXCEPTION 'Tokens insuficientes (tienes %)', COALESCE(v_token.quantity, 0);
  END IF;

  UPDATE player_training_tokens
  SET quantity = quantity - p_amount
  WHERE player_id = p_player_id AND stat = p_stat;

  EXECUTE format('UPDATE heroes SET %I = %I + $1 WHERE id = $2', p_stat, p_stat)
  USING p_amount, p_hero_id;

  EXECUTE format('SELECT %I FROM heroes WHERE id = $1', p_stat)
  INTO v_hero_val USING p_hero_id;

  RETURN jsonb_build_object(
    'new_stat_value', v_hero_val,
    'tokens_remaining', v_token.quantity - p_amount
  );
END;
$$;
