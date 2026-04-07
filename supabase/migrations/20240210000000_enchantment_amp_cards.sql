-- Cartas con enchantment_amp: amplifican los bonos de runas incrustadas en ítems
-- Requiere Herrería Nv.2+ para que tenga efecto (sin runas, sin amplificación)

INSERT INTO public.skill_cards (name, card_category, bonuses, penalties, description) VALUES

('Tallador de Runas', 'equipment',
  '[{"stat":"enchantment_amp","value":0.10}]',
  '[{"stat":"agility","value":5}]',
  'Sus runas brillan con más intensidad. Cargarlo ralentiza al portador.'),

('Archivista Arcano', 'hybrid',
  '[{"stat":"enchantment_amp","value":0.08},{"stat":"intelligence","value":4}]',
  '[{"stat":"strength","value":6},{"stat":"defense","value":3}]',
  'Estudia las runas antiguas sin descanso. Sabe mucho; su cuerpo, poco.');
