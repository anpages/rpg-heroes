-- Habilitar Supabase Realtime para las tablas principales del juego.
-- Esto permite suscripciones push via postgres_changes en el frontend.
-- Usa DO block porque ALTER PUBLICATION no soporta IF NOT EXISTS.

DO $$
DECLARE
  _tbl text;
BEGIN
  FOR _tbl IN
    SELECT unnest(ARRAY[
      'resources','buildings','heroes',
      'player_crafting_queue','player_potion_crafting','player_potions',
      'player_research','training_rooms','player_training_tokens',
      'hero_training','inventory_items','expeditions'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = _tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', _tbl);
    END IF;
  END LOOP;
END;
$$;
