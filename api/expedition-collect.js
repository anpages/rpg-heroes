import { createClient } from '@supabase/supabase-js'
import { getEffectiveStats } from './_stats.js'
import { attackMultiplier as calcAttackMultiplier } from '../src/lib/gameFormulas.js'
import { progressMissions } from './_missions.js'
import { rollItemDrop, rollCardDrop } from './_loot.js'
import { isUUID, safeHours } from './_validate.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { expeditionId } = req.body
  if (!expeditionId) return res.status(400).json({ error: 'expeditionId requerido' })
  if (!isUUID(expeditionId)) return res.status(400).json({ error: 'expeditionId inválido' })

  // Obtener expedición
  const { data: expedition, error: expError } = await supabase
    .from('expeditions')
    .select('*')
    .eq('id', expeditionId)
    .single()

  if (expError || !expedition) return res.status(404).json({ error: 'Expedición no encontrada' })
  if (new Date(expedition.ends_at) > new Date()) return res.status(409).json({ error: 'La expedición aún no ha terminado' })
  if (expedition.status === 'completed') return res.status(409).json({ error: 'Las recompensas ya fueron recogidas' })

  // Obtener héroe y verificar que pertenece al usuario
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .select('id, player_id, experience, level, active_effects')
    .eq('id', expedition.hero_id)
    .single()

  if (heroError || !hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Obtener recursos actuales — se hace snapshot de todos los recursos pasivos antes de mover last_collected_at
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (resourcesError || !resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  // Obtener dungeon (necesario para peligro y loot)
  const { data: dungeon } = await supabase
    .from('dungeons').select('difficulty, type').eq('id', expedition.dungeon_id).single()

  // Stats efectivas para bonificaciones
  const stats = await getEffectiveStats(supabase, hero.id)

  // Ataque escala oro y XP (hasta +100%)
  const attackMultiplier = calcAttackMultiplier(stats?.attack)
  const xpBoost  = hero.active_effects?.xp_boost ?? 0
  const finalGold = Math.round((expedition.gold_earned ?? 0) * attackMultiplier)
  const finalXp   = Math.round((expedition.experience_earned ?? 0) * attackMultiplier * (1 + xpBoost))

  // Pérdida de durabilidad: escala con el peligro del dungeon, reducida por defensa y cartas
  // Peligro 1 → base 1, peligro 9 → base 5; defensa y carta Herrero reducen, Destrozador aumenta
  const dangerBase = dungeon ? 1 + Math.floor(dungeon.difficulty / 2) : 3
  const durabilityLoss = Math.max(0, (stats
    ? dangerBase - Math.floor(stats.defense / 15)
    : dangerBase
  ) + (stats?.durabilityMod ?? 0))

  // Inteligencia mejora drops de cartas
  const intelligenceBonus = stats ? Math.min(0.20, stats.intelligence * 0.003) : 0

  // Añadir oro y hacer snapshot de recursos pasivos antes de mover last_collected_at
  const nowMs = Date.now()
  const hours = safeHours(resources.last_collected_at, nowMs)
  const snapshotIron = Math.floor(resources.iron + resources.iron_rate * hours)
  const snapshotWood = Math.floor(resources.wood + resources.wood_rate * hours)
  const snapshotMana = Math.floor(resources.mana + resources.mana_rate * hours)
  const { error: updateResourcesError } = await supabase
    .from('resources')
    .update({
      gold: resources.gold + finalGold,
      iron: snapshotIron,
      wood: snapshotWood,
      mana: snapshotMana,
      last_collected_at: new Date(nowMs).toISOString(),
    })
    .eq('player_id', user.id)

  if (updateResourcesError) return res.status(500).json({ error: updateResourcesError.message })

  // Añadir XP y subir nivel si corresponde
  const newXp = hero.experience + finalXp
  const xpForLevel = hero.level * 150
  const levelUp = newXp >= xpForLevel

  // Consumir xp_boost si se usó
  const newEffects = { ...(hero.active_effects ?? {}) }
  if (xpBoost) delete newEffects.xp_boost

  const { error: updateHeroError } = await supabase
    .from('heroes')
    .update({
      status: 'idle',
      experience:     levelUp ? newXp - xpForLevel : newXp,
      level:          levelUp ? hero.level + 1 : hero.level,
      active_effects: newEffects,
    })
    .eq('id', hero.id)

  if (updateHeroError) return res.status(500).json({ error: updateHeroError.message })

  // Marcar expedición como completada
  await supabase
    .from('expeditions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', expeditionId)

  // Reducir durabilidad del equipo equipado
  await supabase.rpc('reduce_equipment_durability', { p_hero_id: hero.id, amount: durabilityLoss })

  const drop     = dungeon ? await rollItemDrop(supabase, hero.id, user.id, { difficulty: dungeon.difficulty, poolKey: dungeon.type, dropRateBonus: stats?.itemDropRateBonus ?? 0 }) : null
  const cardDrop = dungeon ? await rollCardDrop(supabase, hero.id, dungeon.type, intelligenceBonus) : null

  // Progreso de misiones diarias
  await Promise.all([
    progressMissions(supabase, user.id, 'expeditions_complete', 1),
    progressMissions(supabase, user.id, 'gold_earn', finalGold),
    progressMissions(supabase, user.id, 'xp_earn', finalXp),
    dungeon ? progressMissions(supabase, user.id, `dungeon_type_${dungeon.type}`, 1) : Promise.resolve(),
    drop && !drop.full ? progressMissions(supabase, user.id, 'item_drop', 1) : Promise.resolve(),
  ])

  return res.status(200).json({
    ok: true,
    rewards: {
      gold: finalGold,
      experience: finalXp,
    },
    levelUp,
    drop:     drop     ?? null,
    cardDrop: cardDrop ?? null,
  })
}
