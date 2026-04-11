-- 6 ofertas especiales adicionales. La rotación sigue siendo 2 slots diarios
-- por héroe: con más candidatos, la rotación semanal se siente variada.

INSERT INTO shop_special_catalog (id, name, description, gold_price, effect_type, effect_value, icon) VALUES
  ('gold_boost',      'Elixir de Oro Ardiente',   'La próxima expedición otorga +50% de oro.',                      1200, 'gold_boost',      50,   'coins'),
  ('fragments_grant', 'Pergamino de los Fragmentos','Añade 10 fragmentos al inventario inmediatamente.',             2000, 'fragments_grant', 10,   'gem'),
  ('training_boost',  'Bendición del Adiestrador', 'La próxima recolección de entrenamiento duplica la XP ganada.', 1500, 'training_boost',  1,    'dumbbell'),
  ('card_guaranteed', 'Mapa del Tesoro',           'Garantiza el drop de una carta en la próxima expedición.',      1800, 'card_guaranteed', 1,    'map'),
  ('random_rune',     'Libro de Runas',            'Añade una runa aleatoria al inventario del jugador.',           2500, 'random_rune',     1,    'zap'),
  ('free_repair',     'Sello del Armero',          'La próxima reparación manual del héroe es gratis.',             600,  'free_repair',     1,    'hammer')
ON CONFLICT (id) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  gold_price   = EXCLUDED.gold_price,
  effect_type  = EXCLUDED.effect_type,
  effect_value = EXCLUDED.effect_value,
  icon         = EXCLUDED.icon;
