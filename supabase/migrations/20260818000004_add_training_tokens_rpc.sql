-- RPC atómica para producir training tokens sin race condition
-- Reemplaza el loop read-then-write de training-collect.js

CREATE OR REPLACE FUNCTION add_training_tokens(
  p_player_id UUID,
  p_gains     JSONB  -- e.g. {"strength": 2, "agility": 1}
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stat TEXT;
  v_qty  INT;
BEGIN
  FOR v_stat, v_qty IN SELECT key, value::INT FROM jsonb_each(p_gains)
  LOOP
    INSERT INTO player_training_tokens (player_id, stat, quantity)
    VALUES (p_player_id, v_stat, v_qty)
    ON CONFLICT (player_id, stat) DO UPDATE
      SET quantity = player_training_tokens.quantity + EXCLUDED.quantity;
  END LOOP;
END;
$$;
