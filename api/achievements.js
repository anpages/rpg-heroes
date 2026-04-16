import { requireAuth } from './_auth.js'
import { computeBaseLevel } from '../src/lib/gameConstants.js'

const RARITY_RANK = { rare: 1, epic: 2, legendary: 3 }

/**
 * GET /api/achievements
 * Devuelve el catálogo completo con progreso calculado en tiempo real.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

  const [
    { data: catalog },
    { data: claimed },
    { data: heroes },
    { data: buildings },
  ] = await Promise.all([
    supabase.from('achievements_catalog').select('*').order('sort_order'),
    supabase.from('player_achievements').select('achievement_id, claimed').eq('player_id', user.id),
    supabase.from('heroes').select('id, level').eq('player_id', user.id),
    supabase.from('buildings').select('type, level, unlocked').eq('player_id', user.id),
  ])

  const heroIds     = (heroes ?? []).map(h => h.id)
  const claimedSet  = new Set((claimed ?? []).filter(c => c.claimed).map(c => c.achievement_id))

  const [
    { data: towerData },
    { count: expCount },
    { data: tacticsData },
    { data: equippedItems },
  ] = await Promise.all([
    heroIds.length
      ? supabase.from('tower_progress').select('max_floor').in('hero_id', heroIds)
      : { data: [] },
    heroIds.length
      ? supabase.from('expeditions').select('id', { count: 'exact', head: true }).in('hero_id', heroIds).eq('status', 'completed')
      : { count: 0 },
    heroIds.length
      ? supabase.from('hero_tactics').select('tactic_id, level').in('hero_id', heroIds)
      : { data: [] },
    heroIds.length
      ? supabase.from('inventory_items').select('item_catalog(rarity)').in('hero_id', heroIds).eq('equipped', true)
      : { data: [] },
  ])

  // Tácticas: distintas + nivel máximo
  const tacticIds    = new Set((tacticsData ?? []).map(t => t.tactic_id))
  const maxTacticLvl = (tacticsData ?? []).reduce((m, t) => Math.max(m, t.level ?? 0), 0)

  // Rareza máxima equipada (0=ninguna, 1=rare, 2=epic, 3=legendary)
  const maxRarityRank = (equippedItems ?? []).reduce((m, i) => {
    const rank = RARITY_RANK[i.item_catalog?.rarity] ?? 0
    return Math.max(m, rank)
  }, 0)

  const stats = {
    heroes_unlocked:       heroes?.length ?? 0,
    hero_level:            (heroes ?? []).reduce((m, h) => Math.max(m, h.level ?? 0), 0),
    base_level:            computeBaseLevel(buildings ?? []),
    tower_floor:           (towerData ?? []).reduce((m, t) => Math.max(m, t.max_floor ?? 0), 0),
    expeditions_complete:  expCount ?? 0,
    tactics_collection:    tacticIds.size,
    tactic_max_level:      maxTacticLvl,
    item_rarity_equipped:  maxRarityRank,
  }

  const achievements = (catalog ?? []).map(a => ({
    ...a,
    current:   Math.min(stats[a.condition_type] ?? 0, a.condition_value),
    completed: (stats[a.condition_type] ?? 0) >= a.condition_value,
    claimed:   claimedSet.has(a.id),
  }))

  return res.status(200).json({ achievements })
}
