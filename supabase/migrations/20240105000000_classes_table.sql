create table public.classes (
  id           text primary key,
  name         text not null,
  description  text not null,
  color        text not null,
  bg_color     text not null,
  border_color text not null,
  strength     integer not null,
  agility      integer not null,
  intelligence integer not null,
  max_hp       integer not null,
  attack       integer not null,
  defense      integer not null,
  starting_ability text not null
);

alter table public.classes enable row level security;
create policy "classes: public read" on public.classes for select using (true);

-- Seed (debe ir antes del FK)
insert into public.classes (id, name, description, color, bg_color, border_color, strength, agility, intelligence, max_hp, attack, defense, starting_ability) values
  ('caudillo',  'Caudillo',  'Guerrero implacable que aplasta a sus enemigos con fuerza bruta y voluntad de hierro.',                    '#dc2626', '#fef2f2', '#fecaca', 16, 10,  5, 140, 14, 8, 'torbellino'),
  ('arcanista', 'Arcanista', 'Canalizador de energías primordiales. Destruye hordas enteras, pero su cuerpo es frágil como el cristal.', '#7c3aed', '#f5f3ff', '#ddd6fe',  5,  8, 18,  70, 18, 2, 'bola_de_fuego'),
  ('sombra',    'Sombra',    'Cazador veloz que actúa desde la oscuridad. Golpea primero, desaparece después.',                          '#0369a1', '#f0f9ff', '#bae6fd',  8, 18,  8,  80, 13, 3, 'golpe_sombrio'),
  ('domador',   'Domador',   'Vínculo entre lo salvaje y lo humano. Combate junto a sus bestias, equilibrado y resistente.',              '#16a34a', '#f0fdf4', '#bbf7d0', 10, 10, 12, 110, 11, 6, 'invocar_bestia');

-- Migrar héroes con clases eliminadas a caudillo
update public.heroes set class = 'caudillo' where class not in ('caudillo', 'arcanista', 'sombra', 'domador');

-- FK desde heroes.class hacia classes.id
alter table public.heroes
  add constraint fk_hero_class foreign key (class) references public.classes(id);
