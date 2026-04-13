-- Corregir nombres de recetas Nv4 y Nv5

-- Nv4
UPDATE crafting_catalog SET name = 'Viga Maestra', description = 'Pieza estructural de madera y fibra de alta resistencia.', icon = '🪵'
WHERE id = 'elven_wood';
-- Renombrar ID no es posible, así que eliminamos y reinsertamos
DELETE FROM crafting_catalog WHERE id IN ('elven_wood', 'mystic_alloy', 'crystallized_essence', 'arcane_tincture');
DELETE FROM crafting_catalog WHERE id IN ('ancestral_framework', 'primordial_metal', 'ethereal_core', 'primordial_balm');

-- Nv4
INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level)
VALUES
  ('master_beam',       'Viga Maestra',       'Pieza estructural de madera y fibra de alta resistencia.',
   'refining', '🪵', '[{"resource":"wood","qty":8},{"resource":"fiber","qty":5}]', 1, 8, 0, 'carpinteria', 4),
  ('steel_gear',        'Engranaje de Acero', 'Pieza mecánica de precisión forjada en acero.',
   'refining', '⚙️', '[{"resource":"iron","qty":8},{"resource":"coal","qty":5}]', 1, 8, 0, 'fundicion', 4),
  ('mana_lens',         'Lente de Maná',      'Lente pulida que canaliza energía arcana.',
   'refining', '🔍', '[{"resource":"mana","qty":8},{"resource":"arcane_dust","qty":5}]', 1, 8, 0, 'destileria_arcana', 4),
  ('essential_oil',     'Aceite Esencial',    'Destilado concentrado de hierbas y flores.',
   'refining', '🫗', '[{"resource":"herbs","qty":6},{"resource":"flowers","qty":5}]', 1, 8, 0, 'herbolario', 4)
ON CONFLICT (id) DO NOTHING;

-- Nv5
INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level)
VALUES
  ('assembled_panel',   'Panel Ensamblado',   'Panel multicapa de madera y fibra entrelazada.',
   'refining', '🪵', '[{"resource":"wood","qty":12},{"resource":"fiber","qty":7}]', 1, 10, 0, 'carpinteria', 5),
  ('forged_steel',      'Acero Forjado',      'Acero trabajado a altas temperaturas con carbón puro.',
   'refining', '🔨', '[{"resource":"iron","qty":12},{"resource":"coal","qty":7}]', 1, 10, 0, 'fundicion', 5),
  ('arcane_condenser',  'Condensador Arcano', 'Dispositivo que almacena y comprime energía mágica.',
   'refining', '⚗️', '[{"resource":"mana","qty":12},{"resource":"arcane_dust","qty":7}]', 1, 10, 0, 'destileria_arcana', 5),
  ('cataplasm',         'Cataplasma',         'Preparado medicinal espeso de hierbas y flores.',
   'refining', '🩹', '[{"resource":"herbs","qty":8},{"resource":"flowers","qty":7}]', 1, 10, 0, 'herbolario', 5)
ON CONFLICT (id) DO NOTHING;
