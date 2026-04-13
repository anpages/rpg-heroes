-- Añade Poción de Vida al Taller (restaura 40% HP, crafteable con hierbas)

INSERT INTO crafting_catalog
  (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  (
    'potion_vida',
    'Poción de Vida',
    'Restaura el 40% del HP máximo del héroe al iniciar una expedición.',
    'potion', '💊',
    '[{"resource":"herbs","qty":15}]'::jsonb,
    1, 10, 1, 'laboratory', 0,
    '[{"type":"hp_restore","value":0.40}]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
