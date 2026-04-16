-- Consumibles de combate crafteable en el Laboratorio.
-- Se usan antes de iniciar un Combate de Práctica (quick-combat).
-- Los efectos se almacenan en hero.active_effects y se consumen al combatir.

INSERT INTO crafting_catalog
  (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  (
    'elixir_furia',
    'Elixir de Furia',
    'Reduce el período entre golpes críticos en 2 rondas durante el siguiente combate.',
    'consumable', '⚡',
    '[{"resource":"mana","qty":20},{"resource":"herbs","qty":10}]'::jsonb,
    1, 30, 1, 'laboratory', 0,
    '[{"type":"crit_boost","value":2}]'::jsonb
  ),
  (
    'unguento_corrosivo',
    'Ungüento Corrosivo',
    'Penetra el 20% de la armadura del enemigo durante el siguiente combate.',
    'consumable', '☠',
    '[{"resource":"iron","qty":12},{"resource":"herbs","qty":12}]'::jsonb,
    1, 30, 1, 'laboratory', 0,
    '[{"type":"armor_pen","value":0.20}]'::jsonb
  ),
  (
    'escudo_mana',
    'Escudo de Maná',
    'El primer golpe recibido es esquivado completamente en el siguiente combate.',
    'consumable', '🔮',
    '[{"resource":"mana","qty":30},{"resource":"wood","qty":10}]'::jsonb,
    1, 45, 2, 'laboratory', 0,
    '[{"type":"combat_shield","value":1}]'::jsonb
  ),
  (
    'elixir_sangre',
    'Elixir de Sangre',
    'Roba el 15% del daño infligido como vida en el siguiente combate.',
    'consumable', '🩸',
    '[{"resource":"herbs","qty":18},{"resource":"mana","qty":12}]'::jsonb,
    1, 45, 2, 'laboratory', 0,
    '[{"type":"lifesteal_pct","value":0.15}]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  inputs        = EXCLUDED.inputs,
  output_qty    = EXCLUDED.output_qty,
  craft_minutes = EXCLUDED.craft_minutes,
  effects       = EXCLUDED.effects;
