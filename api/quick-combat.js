import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat } from './_combat.js'
import { trainingRewards, heroAnchoredEnemyStats, applyArchetype, decoratedEnemyName } from '../src/lib/gameFormulas.js'
import { interpolateHP, canPlay, applyCombatHpCost } from './_hp.js'
import { isUUID } from './_validate.js'
import { progressMissions } from './_missions.js'
import { COMBAT_HP_COST, WEAR_PROFILE } from '../src/lib/gameConstants.js'
import { computeRatingUpdate, quickCombatDifficulty, quickCombatVirtualLevel } from './_rating.js'
import { generateEnemyTactics } from './_enemyTactics.js'
import { rollTacticDrop } from './_loot.js'
import { verifyCombatToken } from './_combatSign.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, previewToken } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (!previewToken)   return res.status(400).json({ error: 'previewToken requerido' })

  let preview
  try {
    preview = verifyCombatToken(previewToken)
  } catch (e) {
    return res.status(400).json({ error: e.message, code: 'INVALID_PREVIEW' })
  }
  if (preview.type !== 'quick_preview') return res.status(400).json({ error: 'Token de tipo incorrecto' })
  if (preview.userId !== user.id)       return res.status(400).json({ error: 'Token no corresponde al jugador' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at, active_effects, class, combat_rating, combats_played, combats_won, last_combat_at, tier_grace_remaining')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  // Stats efectivas del héroe (antes de interpolar HP para usar max_hp con equipo)
  const heroStats = await getEffectiveStats(supabase, hero.id, user.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

  // Verificar HP mínimo (20%)
  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs, heroStats.max_hp)
  if (!canPlay(currentHp, heroStats.max_hp)) {
    return res.status(409).json({
      error: `HP insuficiente. Necesitas al menos ${Math.floor(heroStats.max_hp * 0.2)} HP para combatir.`,
      code: 'LOW_HP',
    })
  }

  // Aplicar boosts de pociones activas
  const effects = hero.active_effects ?? {}
  if (effects.atk_boost) heroStats.attack  = Math.round(heroStats.attack  * (1 + effects.atk_boost))
  if (effects.def_boost) heroStats.defense = Math.round(heroStats.defense * (1 + effects.def_boost))
  const usedBoosts = Object.fromEntries(
    ['atk_boost', 'def_boost'].filter(k => effects[k]).map(k => [k, effects[k]])
  )

  // Bonos de investigación
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  // Clase y arquetipo del rival vienen del token; stats se calculan ahora
  // ancladas al héroe que el jugador eligió para combatir
  const { archetypeKey, enemyClass, enemyName } = preview
  const { vl, shift } = quickCombatVirtualLevel(hero)
  const enemyStats    = applyArchetype(heroAnchoredEnemyStats(heroStats), archetypeKey)

  // Tácticas del héroe y del enemigo
  const { data: heroTacticRows } = await supabase
    .from('hero_tactics')
    .select('level, tactic_catalog(name, icon, combat_effect)')
    .eq('hero_id', heroId)
    .not('slot_index', 'is', null)
  const heroTactics = (heroTacticRows ?? []).filter(r => r.tactic_catalog).map(r => ({
    name: r.tactic_catalog.name, icon: r.tactic_catalog.icon,
    level: r.level, combat_effect: r.tactic_catalog.combat_effect,
  }))
  const enemyTactics = generateEnemyTactics(vl, archetypeKey)

  // Simular combate — pasar clases para sistema de habilidades
  const result = simulateCombat(heroStats, enemyStats, {
    critBonus: rb.crit_pct,
    dmgMultiplier: rb.tower_dmg_pct,
    classA: hero.class,
    classB: archetypeKey,
    tacticsA: heroTactics,
    tacticsB: enemyTactics,
  })
  const won = result.winner === 'a'

  // Registrar combate
  const rewards = trainingRewards(hero.level)
  await supabase.from('training_combats').insert({
    hero_id:      hero.id,
    won,
    rounds:       result.rounds,
    log:          result.log,
    hero_name:    hero.name,
    enemy_name:   enemyName,
    hero_max_hp:  heroStats.max_hp,
    enemy_max_hp: enemyStats.max_hp,
    gold_reward:  won ? rewards.gold : 0,
    xp_reward:    won ? rewards.experience : 0,
  })

  // Deducir HP — coste plano fijo, gane o pierda. Combate independiente.
  const costPct       = won ? COMBAT_HP_COST.quick.win : COMBAT_HP_COST.quick.loss
  const hpAfterCombat = applyCombatHpCost(currentHp, hero.max_hp, costPct)

  // Limpiar boosts usados
  const newEffects = { ...effects }
  Object.keys(usedBoosts).forEach(k => delete newEffects[k])

  // Rating de combate — la dificultad se calcula a partir del RESULTADO real:
  // si el héroe termina con casi toda la HP, está por debajo de su tier y sube
  // rápido (+25); si apenas sobrevive, el tier es ajustado y la subida se
  // frena (+5). Paliza → sales del low-tier en decenas de combates en vez de
  // cientos, sin tener que inflar los deltas base.
  const quickDifficulty = quickCombatDifficulty({
    won,
    hpLeftA:   result.hpLeftA,
    heroMaxHp: heroStats.max_hp,
  })
  const ratingResult = computeRatingUpdate(hero, {
    won,
    difficulty: quickDifficulty,
    nowMs,
  })
  // Etiqueta narrativa para el cliente: por qué ese delta (solo en victoria).
  const ratingReason = won
    ? (quickDifficulty === 'superior' ? 'crush'
    :  quickDifficulty === 'trivial'  ? 'clutch'
    :  'fair')
    : null

  const { error: hpError, count: hpCount } = await supabase
    .from('heroes')
    .update({
      current_hp:         hpAfterCombat,
      hp_last_updated_at: new Date(nowMs).toISOString(),
      active_effects:     newEffects,
      ...ratingResult.updates,
    })
    .eq('id', hero.id)
    .eq('status', 'idle')

  if (hpError) return res.status(500).json({ error: hpError.message })
  if (hpCount === 0) return res.status(409).json({ error: 'El héroe cambió de estado durante el combate' })

  // Desgaste del equipo — cantidad nominal por WEAR_PROFILE.quick según el
  // resultado. La función SQL escalada lo multiplica luego por rareza × slot.
  // Paliza (>70% HP) → 0: dominaste, el equipo no sufre. Fair → 1. Al límite
  // o derrota → 2. Así farmear low-tier no destroza equipo, pero al llegar al
  // tier justo los combates cobran su precio → loop reparar/mejorar.
  const durKey = won
    ? (quickDifficulty === 'superior' ? 'crush' : quickDifficulty === 'trivial' ? 'clutch' : 'fair')
    : 'loss'
  const durLoss = WEAR_PROFILE.quick[durKey]
  if (durLoss > 0) {
    const { error: durError } = await supabase.rpc('reduce_equipment_durability_scaled', { p_hero_id: hero.id, amount: durLoss })
    if (durError) console.error('durability rpc error:', durError.message)
  }

  // Recompensas solo si gana
  if (won) {
    // Oro + XP atómico con level-up (transacción SQL)
    const { data: rpcResult } = await supabase.rpc('reward_gold_and_xp', {
      p_player_id: user.id,
      p_hero_id:   hero.id,
      p_gold:      rewards.gold,
      p_xp:        rewards.experience,
    })
    rewards.levelUp = rpcResult?.level_up ?? false

    // Drop de táctica (8% en victoria)
    const tacticDrop = await rollTacticDrop(supabase, heroId, hero.class, { chance: 0.08, bonusChance: rb.tactic_drop_pct ?? 0 })
    if (tacticDrop) rewards.tacticDrop = tacticDrop
  }

  // Misiones
  progressMissions(supabase, user.id, 'training_combat', 1).catch(() => {})

  return res.status(200).json({
    ok: true,
    won,
    rounds:       result.rounds,
    log:          result.log,
    heroHpLeft:   result.hpLeftA,
    enemyHpLeft:  result.hpLeftB,
    heroMaxHp:    heroStats.max_hp,
    enemyMaxHp:   enemyStats.max_hp,
    enemyName,
    archetype:    archetypeKey,
    heroClass:    hero.class,
    tierShift:    shift,
    durabilityLoss: durLoss,
    enemyTactics: enemyTactics.map(t => ({ name: t.name, icon: t.icon })),
    rewards:      won ? rewards : null,
    heroCurrentHp:  hpAfterCombat,
    heroRealMaxHp:  hero.max_hp,
    rating: {
      prev:      ratingResult.tierBefore.rating,
      current:   ratingResult.updates.combat_rating,
      delta:     ratingResult.delta,
      reason:    ratingReason,
      decay:     ratingResult.decayApplied,
      graceUsed: ratingResult.graceUsed,
      promoted:  ratingResult.promoted,
      tier:      ratingResult.tierAfter.tier,
      division:  ratingResult.tierAfter.division,
      label:     ratingResult.tierAfter.label,
    },
  })
}
