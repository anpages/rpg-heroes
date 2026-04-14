-- Nuevos consumibles de expedición: Amuleto de Fortuna y Vial de Aceleración
-- Ambos se craftean en el Laboratorio y se usan al iniciar una expedición.

INSERT INTO crafting_catalog
  (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  (
    'amuleto_fortuna',
    'Amuleto de Fortuna',
    '+80% de probabilidad de drop de equipo en la siguiente expedición. Se consume al iniciar.',
    'consumable', '🌟',
    '[{"resource":"fragments","qty":2},{"resource":"mana","qty":25},{"resource":"herbs","qty":20}]'::jsonb,
    1, 45, 1, 'laboratory', 0,
    '[{"type":"expedition_bonus","loot_boost":0.80}]'::jsonb
  ),
  (
    'vial_aceleracion',
    'Vial de Aceleración',
    'Reduce la duración de la siguiente expedición un 35%. Se consume al iniciar.',
    'consumable', '🍶',
    '[{"resource":"herbs","qty":20},{"resource":"mana","qty":15},{"resource":"iron","qty":10}]'::jsonb,
    1, 30, 1, 'laboratory', 0,
    '[{"type":"expedition_bonus","time_reduction":0.35}]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  inputs      = EXCLUDED.inputs,
  output_qty  = EXCLUDED.output_qty,
  craft_minutes = EXCLUDED.craft_minutes,
  effects     = EXCLUDED.effects;
