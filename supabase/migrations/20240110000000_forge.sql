-- ─────────────────────────────────────────────────────────────────────────────
-- Herrería: edificio para reparar durabilidad del equipo
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.buildings (player_id, type, level)
select player_id, 'forge', 1
from public.buildings
where type = 'barracks'
on conflict do nothing;
