-- Permite leer el username de cualquier jugador (para el ranking)
create policy "players: public read" on public.players
  for select using (true);

-- Permite leer nivel y clase de cualquier héroe (para el ranking)
create policy "heroes: public read" on public.heroes
  for select using (true);
