import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { attackMultiplier as calcAttackMultiplier, DUNGEON_DROP_PROFILE } from '../src/lib/gameFormulas.js'
import { progressMissions } from './_missions.js'
import { rollItemDrop, rollTacticDrop, rollMaterialDrop } from './_loot.js'
import { isUUID } from './_validate.js'
import { interpolateHP } from './_hp.js'

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
    .select('id, player_id, experience, level, active_effects, class, status, current_hp, max_hp, hp_last_updated_at, status_ends_at')
    .eq('id', expedition.hero_id)
    .single()

  if (heroError || !hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Obtener dungeon (necesario para peligro y loot)
  const { data: dungeon } = await supabase
    .from('dungeons').select('difficulty, type, name').eq('id', expedition.dungeon_id).single()

  // Stats efectivas para bonificaciones (con bonos de investigación)
  const stats = await getEffectiveStats(supabase, hero.id, user.id)

  // Obtener bonos de investigación para aplicar sobre oro/XP/durabilidad
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  // Perfil de drops de la mazmorra (multiplicadores por tipo)
  const dropProfile = dungeon ? (DUNGEON_DROP_PROFILE[dungeon.type] ?? {}) : {}
  const dpGold   = dropProfile.goldMult   ?? 1
  const dpXp     = dropProfile.xpMult     ?? 1
  const dpItem   = dropProfile.itemMult   ?? 1
  const dpTactic = dropProfile.tacticMult ?? 1

  // Ataque escala oro y XP (hasta +100%)
  const attackMultiplier = calcAttackMultiplier(stats?.attack)
  const xpBoost        = hero.active_effects?.xp_boost ?? 0
  const lootBoost      = hero.active_effects?.loot_boost ?? 0
  const goldBoost      = hero.active_effects?.gold_boost ?? 0
  const tacticGuaranteed = hero.active_effects?.card_guaranteed ?? 0
  const goldBase = Math.round((expedition.gold_earned ?? 0) * attackMultiplier * dpGold)
  const finalGold = Math.round(goldBase * (1 + rb.expedition_gold_pct) * (1 + goldBoost))
  const finalGoldNoBoost = Math.round(goldBase * (1 + rb.expedition_gold_pct))
  const goldBonus = goldBoost > 0 ? Math.max(0, finalGold - finalGoldNoBoost) : 0

  const xpBase    = Math.round((expedition.experience_earned ?? 0) * attackMultiplier * dpXp * (1 + xpBoost))
  const finalXp   = Math.round(xpBase * (1 + rb.expedition_xp_pct))
  const xpBaseNoBoost  = Math.round((expedition.experience_earned ?? 0) * attackMultiplier * dpXp)
  const finalXpNoBoost = Math.round(xpBaseNoBoost * (1 + rb.expedition_xp_pct))
  const xpBonus = xpBoost > 0 ? Math.max(0, finalXp - finalXpNoBoost) : 0

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

  // Roll de material antes del UPDATE para incluirlo en la misma operación.
  const materialDrop = dungeon ? rollMaterialDrop(dungeon.type) : null

  // Consumir boosts de un solo uso
  const newEffects = { ...(hero.active_effects ?? {}) }
  if (xpBoost)        delete newEffects.xp_boost
  if (lootBoost)      delete newEffects.loot_boost
  if (goldBoost)      delete newEffects.gold_boost
  if (tacticGuaranteed) delete newEffects.card_guaranteed

  // Aplicar regen pasiva acumulada desde que terminó la expedición (status_ends_at).
  const nowIso = new Date().toISOString()
  const regeneratedHp = interpolateHP(hero, Date.now(), stats?.max_hp)

  // Atómico: recursos + XP/level-up + hero→idle + expedition→completed
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('complete_expedition_atomic', {
    p_player_id:     user.id,
    p_hero_id:       hero.id,
    p_expedition_id: expeditionId,
    p_gold:          finalGold,
    p_xp:            finalXp,
    p_fragments:     materialDrop?.resource === 'fragments' ? materialDrop.qty : 0,
    p_essence:       materialDrop?.resource === 'essence'   ? materialDrop.qty : 0,
    p_effects:       newEffects,
    p_hp:            regeneratedHp,
    p_hp_updated_at: nowIso,
  })

  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  const levelUp = rpcResult?.level_up ?? false

  // Reducir durabilidad del equipo equipado — la fórmula dinámica (peligro +
  // defensa + cartas + research) se queda en este archivo; la función SQL
  // escalada aplica rareza × slot encima del amount nominal.
  if (durabilityLoss > 0) {
    const { error: durError } = await supabase.rpc('reduce_equipment_durability_scaled', { p_hero_id: hero.id, amount: durabilityLoss })
    if (durError) console.error('durability rpc error:', durError.message)
  }

  const drop        = dungeon ? await rollItemDrop(supabase, hero.id, user.id, { difficulty: dungeon.difficulty, poolKey: dungeon.type, dropRateBonus: stats?.itemDropRateBonus ?? 0, dropRateMult: (1 + lootBoost) * dpItem, heroClass: hero.class }) : null
  const tacticDrop  = dungeon ? await rollTacticDrop(supabase, hero.id, hero.class, { chance: tacticGuaranteed ? 1.0 : ((0.12 + intelligenceBonus) * dpTactic), bonusChance: rb.tactic_drop_pct ?? 0 }) : null
  // materialDrop ya fue rolado y aplicado en el UPDATE de recursos de arriba

  // Progreso de misiones diarias (no bloquean la respuesta)
  Promise.all([
    progressMissions(supabase, user.id, 'expeditions_complete', 1),
    progressMissions(supabase, user.id, 'gold_earn', finalGold),
    progressMissions(supabase, user.id, 'xp_earn', finalXp),
    dungeon ? progressMissions(supabase, user.id, `dungeon_type_${dungeon.type}`, 1) : Promise.resolve(),
    drop && !drop.full ? progressMissions(supabase, user.id, 'item_drop', 1) : Promise.resolve(),
  ]).catch(e => console.error('mission progress error:', e.message))

  return res.status(200).json({
    ok: true,
    rewards: {
      gold: finalGold,
      experience: finalXp,
      goldBonus,
      xpBonus,
    },
    levelUp,
    drop:         drop         ?? null,
    tacticDrop:   tacticDrop   ?? null,
    materialDrop: materialDrop ?? null,
  })
}
