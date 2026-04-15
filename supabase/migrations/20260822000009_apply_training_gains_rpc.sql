-- RPC que aplica ganancias de entrenamiento directamente al héroe
-- Reemplaza el flujo token → assign por collect → stat directo.
CREATE OR REPLACE FUNCTION apply_training_gains(
  p_hero_id uuid,
  p_gains   jsonb   -- e.g. { "strength": 1, "agility": 2 }
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE heroes SET
    strength     = strength     + COALESCE((p_gains->>'strength')::int,     0),
    agility      = agility      + COALESCE((p_gains->>'agility')::int,      0),
    attack       = attack       + COALESCE((p_gains->>'attack')::int,       0),
    defense      = defense      + COALESCE((p_gains->>'defense')::int,      0),
    max_hp       = max_hp       + COALESCE((p_gains->>'max_hp')::int,       0),
    intelligence = intelligence + COALESCE((p_gains->>'intelligence')::int, 0)
  WHERE id = p_hero_id
    AND player_id = auth.uid();
END;
$$;
