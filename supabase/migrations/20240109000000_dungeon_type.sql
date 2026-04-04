-- ─────────────────────────────────────────────────────────────────────────────
-- Añade tipo a mazmorras y nuevas mazmorras para cubrir la curva de dificultad
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.dungeons
  add column if not exists type text not null default 'combat';

-- Tipos de las mazmorras existentes
update public.dungeons set type = 'combat'     where name = 'Cueva de Goblins';
update public.dungeons set type = 'wilderness' where name = 'Bosque Oscuro';
update public.dungeons set type = 'magic'      where name = 'Ruinas Encantadas';
update public.dungeons set type = 'combat'     where name = 'Guarida del Dragón';

-- ─────────────────────────────────────────────────────────────────────────────
-- Nuevas mazmorras
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.dungeons
  (name, description, difficulty, min_hero_level, duration_minutes,
   gold_min, gold_max, wood_min, wood_max, mana_min, mana_max,
   experience_reward, type)
values
  (
    'Cripta de los Condenados',
    'Una cripta ancestral donde los muertos no descansan. Sus pasillos rezuman frío y las armaduras de los caídos siguen en pie.',
    4, 4, 15,
    60, 150,  30, 70,  20, 50,
    80, 'crypt'
  ),
  (
    'Minas de Hierro Oscuro',
    'Excavaciones abandonadas infestadas de criaturas subterráneas. El mineral que aquí se forja es de una dureza excepcional.',
    6, 6, 25,
    100, 250,  60, 150,  15, 40,
    150, 'mine'
  ),
  (
    'Templo de los Antiguos',
    'Un templo olvidado cubierto de runas. Los guardianes que lo protegen llevan milenios esperando a que alguien ose profanarlo.',
    8, 8, 35,
    200, 500,  50, 150,  80, 200,
    280, 'ancient'
  );
