-- Separar bonos de entrenamiento de la stat base del héroe.
-- Los puntos ganados en salas de entrenamiento se acumulan en training_bonuses JSONB
-- en lugar de sumarse directamente al stat. _stats.js los suma al calcular stats efectivas.
-- Héroes existentes: training_bonuses empieza en '{}' (sin datos previos que separar).

ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS training_bonuses JSONB NOT NULL DEFAULT '{}';

-- Actualizar apply_training_gains para incrementar training_bonuses en lugar del stat directo
DROP FUNCTION IF EXISTS apply_training_gains(uuid, jsonb);
CREATE OR REPLACE FUNCTION apply_training_gains(
  p_hero_id uuid,
  p_gains   jsonb   -- e.g. { "strength": 1, "agility": 2 }
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bonuses jsonb;
  v_stat    text;
  v_val     int;
BEGIN
  SELECT COALESCE(training_bonuses, '{}') INTO v_bonuses
  FROM heroes WHERE id = p_hero_id AND player_id = auth.uid();

  FOR v_stat, v_val IN SELECT key, value::int FROM jsonb_each_text(p_gains) LOOP
    v_bonuses := jsonb_set(
      v_bonuses,
      ARRAY[v_stat],
      to_jsonb(COALESCE((v_bonuses->>v_stat)::int, 0) + v_val)
    );
  END LOOP;

  UPDATE heroes SET training_bonuses = v_bonuses
  WHERE id = p_hero_id AND player_id = auth.uid();

  RETURN v_bonuses;
END;
$$;

-- Actualizar assign_training_atomic para incrementar training_bonuses en lugar del stat directo
DROP FUNCTION IF EXISTS assign_training_atomic(uuid, uuid, text, int);
CREATE OR REPLACE FUNCTION assign_training_atomic(
  p_player_id uuid,
  p_hero_id   uuid,
  p_stat      text,
  p_amount    int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token    record;
  v_bonuses  jsonb;
  v_new_val  int;
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

  SELECT COALESCE(training_bonuses, '{}') INTO v_bonuses
  FROM heroes WHERE id = p_hero_id;

  v_new_val := COALESCE((v_bonuses->>p_stat)::int, 0) + p_amount;
  v_bonuses := jsonb_set(v_bonuses, ARRAY[p_stat], to_jsonb(v_new_val));

  UPDATE heroes SET training_bonuses = v_bonuses WHERE id = p_hero_id;

  RETURN jsonb_build_object(
    'new_stat_value',    v_new_val,
    'tokens_remaining',  v_token.quantity - p_amount
  );
END;
$$;
