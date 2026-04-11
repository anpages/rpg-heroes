import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat } from './_combat.js'
import {
  tierAnchoredEnemyStats,
  trainingEnemyName,
  trainingRewards,
  xpRequiredForLevel,
  randomArchetype,
  applyArchetype,
  decoratedEnemyName,
} from '../src/lib/gameFormulas.js'
import { interpolateHP, canPlay, applyCombatHpCost } from './_hp.js'
import { isUUID, snapshotResources } from './_validate.js'
import { progressMissions } from './_missions.js'
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'
import { computeRatingUpdate, quickCombatDifficulty, quickCombatVirtualLevel } from './_rating.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at, active_effects, class, combat_rating, combats_played, combats_won, last_combat_at, tier_grace_remaining')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  // Verificar HP mínimo (20%)
  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs)
  if (!canPlay(currentHp, hero.max_hp)) {
    return res.status(409).json({
      error: `HP insuficiente. Necesitas al menos ${Math.floor(hero.max_hp * 0.2)} HP para combatir.`,
      code: 'LOW_HP',
    })
  }

  // Stats efectivas del héroe
  const heroStats = await getEffectiveStats(supabase, hero.id, user.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

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

  // Enemigo anclado al TIER del héroe con mezcla por progreso (estilo LoL):
  //   - Tramo bajo: a veces te cruzas con un rival del tier inferior
  //   - Tramo alto: a veces te cruzas con uno del tier superior (preview)
  // Si tu equipo es pobre para el tier, pierdes: ese es el incentivo para
  // expediciones/cámaras/reparar. Gear → tier progression.
  const { vl, shift }  = quickCombatVirtualLevel(hero)
  const baseEnemyStats = tierAnchoredEnemyStats(vl)
  const archetypeKey   = randomArchetype()
  const enemyStats     = applyArchetype(baseEnemyStats, archetypeKey)
  const enemyName      = decoratedEnemyName(trainingEnemyName(hero.level), archetypeKey)

  // Simular combate
  const result = simulateCombat(heroStats, enemyStats, {
    critBonus: rb.crit_pct,
    dmgMultiplier: rb.tower_dmg_pct,
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
  const ratingResult = computeRatingUpdate(hero, {
    won,
    difficulty: quickCombatDifficulty({
      won,
      hpLeftA:   result.hpLeftA,
      heroMaxHp: heroStats.max_hp,
    }),
    nowMs,
  })

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

  // Recompensas solo si gana
  if (won) {
    // Oro
    const { data: resources } = await supabase
      .from('resources')
      .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
      .eq('player_id', user.id)
      .single()

    if (resources) {
      const snap = snapshotResources(resources)
      await supabase
        .from('resources')
        .update({ gold: snap.gold + rewards.gold, iron: snap.iron, wood: snap.wood, mana: snap.mana, last_collected_at: snap.nowIso })
        .eq('player_id', user.id)
    }

    // XP
    const newXp = hero.experience + rewards.experience
    const xpForLevel = xpRequiredForLevel(hero.level)
    const levelUp = newXp >= xpForLevel

    await supabase
      .from('heroes')
      .update({
        experience: levelUp ? newXp - xpForLevel : newXp,
        level: levelUp ? hero.level + 1 : hero.level,
      })
      .eq('id', hero.id)

    rewards.levelUp = levelUp
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
    tierShift:    shift,
    rewards:      won ? rewards : null,
    heroCurrentHp:  hpAfterCombat,
    heroRealMaxHp:  hero.max_hp,
    rating: {
      prev:      ratingResult.tierBefore.rating,
      current:   ratingResult.updates.combat_rating,
      delta:     ratingResult.delta,
      decay:     ratingResult.decayApplied,
      graceUsed: ratingResult.graceUsed,
      promoted:  ratingResult.promoted,
      tier:      ratingResult.tierAfter.tier,
      division:  ratingResult.tierAfter.division,
      label:     ratingResult.tierAfter.label,
    },
  })
}
