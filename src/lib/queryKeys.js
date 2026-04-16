/**
 * Claves centralizadas para TanStack Query.
 * Usar siempre estas constantes para invalidar, setear o leer caché.
 *
 * Invalidar todo de un tipo:  invalidateQueries({ queryKey: ['heroes'] })
 * Invalidar uno concreto:     invalidateQueries({ queryKey: queryKeys.hero(id) })
 */
export const queryKeys = {
  resources:       (userId) => ['resources', userId],
  heroes:          (userId) => ['heroes', userId],
  hero:            (heroId) => ['hero', heroId],
  inventory:       (heroId) => ['inventory', heroId],
  heroTactics:     (heroId) => ['hero-tactics', heroId],
  buildings:       (userId) => ['buildings', userId],
  missions:        ()       => ['missions', 'me'],
  dungeons:        ()       => ['dungeons'],
  activeExpedition:(heroId) => ['expedition-active', heroId],
  craftedItems:    (userId) => ['crafted-items', userId],
  towerProgress:   (heroId) => ['tower-progress', heroId],
  classes:         ()       => ['classes'],
  combatHistory:   (heroId) => ['combat-history', heroId],
  training:        (heroId) => ['training', heroId],
  trainingRooms:   (userId) => ['training-rooms', userId],
  potions:         (userId) => ['potions', userId],
  research:        (userId) => ['research', userId],
  trainingTokens:  (userId) => ['training-tokens', userId],
  ranking:         ()       => ['ranking'],
  achievements:    (userId) => ['achievements', userId],
}
