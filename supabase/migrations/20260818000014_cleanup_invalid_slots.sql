-- Elimina slots con unit_duration_ms inválido o cantidad 0
DELETE FROM player_refining_slots
WHERE unit_duration_ms IS NULL
   OR unit_duration_ms <= 0
   OR quantity <= 0;

-- Elimina slots completados hace más de 1 hora (no recogidos)
DELETE FROM player_refining_slots
WHERE unit_duration_ms > 0
  AND quantity > 0
  AND craft_started_at + make_interval(secs => (quantity * unit_duration_ms / 1000.0)) < now() - interval '1 hour';
