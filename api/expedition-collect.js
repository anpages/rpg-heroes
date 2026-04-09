import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { attackMultiplier as calcAttackMultiplier, xpRequiredForLevel } from '../src/lib/gameFormulas.js'
import { progressMissions } from './_missions.js'
import { rollItemDrop, rollCardDrop, rollMaterialDrop } from './_loot.js'
import { isUUID, snapshotResources } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

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
    .select('gold, iron, wood, mana, fragments, essence, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (resourcesError || !resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  // Obtener dungeon (necesario para peligro y loot)
  const { data: dungeon } = await supabase
    .from('dungeons').select('difficulty, type, name').eq('id', expedition.dungeon_id).single()

  // Stats efectivas para bonificaciones (con bonos de investigación)
  const stats = await getEffectiveStats(supabase, hero.id, user.id)

  // Obtener bonos de investigación para aplicar sobre oro/XP/durabilidad
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  // Ataque escala oro y XP (hasta +100%)
  const attackMultiplier = calcAttackMultiplier(stats?.attack)
  const xpBoost  = hero.active_effects?.xp_boost ?? 0
  const goldBase = Math.round((expedition.gold_earned ?? 0) * attackMultiplier)
  const finalGold = Math.round(goldBase * (1 + rb.expedition_gold_pct))
  const xpBase    = Math.round((expedition.experience_earned ?? 0) * attackMultiplier * (1 + xpBoost))
  const finalXp   = Math.round(xpBase * (1 + rb.expedition_xp_pct))

  // Pérdida de durabilidad: escala con el peligro del dungeon, reducida por defensa y cartas
  // Peligro 1 → base 1, peligro 9 → base 5; defensa y carta Herrero reducen, Destrozador aumenta
  const dangerBase = dungeon ? 1 + Math.floor(dungeon.difficulty / 2) : 3
  const rawDurabilityLoss = (stats
    ? dangerBase - Math.floor(stats.defense / 15)
    : dangerBase
  ) + (stats?.durabilityMod ?? 0)
  // durability_loss_pct es negativo (reducción), máximo 0
  const durabilityLoss = Math.max(0, Math.round(rawDurabilityLoss * (1 + rb.durability_loss_pct)))

  // Inteligencia mejora drops de cartas
  const intelligenceBonus = stats ? Math.min(0.20, stats.intelligence * 0.003) : 0

  // Roll de material antes del UPDATE para incluirlo en la misma operación
  const materialDrop = dungeon ? rollMaterialDrop(dungeon.name) : null

  const snap = snapshotResources(resources)
  const { error: updateResourcesError } = await supabase
    .from('resources')
    .update({
      gold:      snap.gold + finalGold,
      iron:      snap.iron,
      wood:      snap.wood,
      mana:      snap.mana,
      fragments: (resources.fragments ?? 0) + (materialDrop?.resource === 'fragments' ? materialDrop.qty : 0),
      essence:   (resources.essence   ?? 0) + (materialDrop?.resource === 'essence'   ? materialDrop.qty : 0),
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)

  if (updateResourcesError) return res.status(500).json({ error: updateResourcesError.message })

  // Añadir XP y subir nivel si corresponde
  const newXp = hero.experience + finalXp
  const xpForLevel = xpRequiredForLevel(hero.level)
  const levelUp = newXp >= xpForLevel

  // Consumir xp_boost si se usó
  const newEffects = { ...(hero.active_effects ?? {}) }
  if (xpBoost) delete newEffects.xp_boost

  const { error: updateHeroError } = await supabase
    .from('heroes')
    .update({
      status: 'idle',
      experience:         levelUp ? newXp - xpForLevel : newXp,
      level:              levelUp ? hero.level + 1 : hero.level,
      active_effects:     newEffects,
      hp_last_updated_at: new Date().toISOString(),
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
  // materialDrop ya fue rolado y aplicado en el UPDATE de recursos de arriba

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
    drop:         drop         ?? null,
    cardDrop:     cardDrop     ?? null,
    materialDrop: materialDrop ?? null,
  })
}
