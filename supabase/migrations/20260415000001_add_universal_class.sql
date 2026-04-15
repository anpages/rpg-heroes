-- Añade la clase Universal: el quinto héroe que desbloquea el jugador al llegar a base Nv.10.
-- Stats equilibradas — sin punto débil evidente, sin punto fuerte destacado.

insert into public.classes (id, name, description, color, bg_color, border_color, strength, agility, intelligence, max_hp, attack, defense, starting_ability)
values (
  'universal',
  'Universal',
  'Maestro del equilibrio. Adapta su estilo a cualquier situación, sin punto débil evidente.',
  '#d97706',
  '#fffbeb',
  '#fde68a',
  11,
  11,
  11,
  105,
  12,
  5,
  'golpe_maestro'
);
