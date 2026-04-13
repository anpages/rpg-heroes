-- Timestamp independiente para el recurso secundario de edificios productivos.
-- Permite recolectar el primario sin perder el progreso fraccionario del secundario.
ALTER TABLE buildings
  ADD COLUMN secondary_collected_at timestamptz DEFAULT now();

-- Sincronizar con el timestamp actual para edificios existentes.
UPDATE buildings SET secondary_collected_at = production_collected_at;
