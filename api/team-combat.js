import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { simulateTeamCombat } from './_teamCombat.js'
import { interpolateHP, canPlay, applyCombatHpCost } from './_hp.js'
import { isUUID } from './_validate.js'
import { progressMissions } from './_missions.js'
import { COMBAT_HP_COST, WEAR_PROFILE } from '../src/lib/gameConstants.js'
import { computeRatingUpdate, teamCombatDifficulty } from './_rating.js'
import { computeSynergy, applySynergyToStats } from '../src/lib/teamSynergy.js'
import {
  trainingEnemyStats,
  trainingEnemyName,
  trainingRewards,
} from '../src/lib/gameFormulas.js'

const ALL_CLASSES = ['caudillo', 'arcanista', 'sombra', 'domador']

/** Genera 3 enemigos con clases distintas, aplicando su propia sinergia de rival. */
function generateEnemyTeam(avgLevel) {
  // Barajar las 4 clases y tomar 3 → equipo rival siempre 3 clases distintas
  const shuffled = ALL_CLASSES.slice().sort(() => Math.random() - 0.5).slice(0, 3)
  const rivalSynergy = computeSynergy(shuffled)

  return shuffled.map((cls) => {
    const base = trainingEnemyStats(avgLevel)
    // +15% máximo HP para rivales (compensar que son 3 contra 3 con sinergia)
    base.max_hp = Math.round(base.max_hp * 1.15)
    const withSynergy = applySynergyToStats(base, rivalSynergy)
    withSynergy.max_hp = base.max_hp
    return {
      name:  `${trainingEnemyName(avgLevel)}`,
      class: cls,
      stats: withSynergy,
    }
  })
}

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroIds } = req.body ?? {}
  if (!Array.isArray(heroIds) || heroIds.length !== 3) {
    return res.status(400).json({ error: 'Debes enviar 3 heroIds' })
  }
  if (new Set(heroIds).size !== 3) {
    return res.status(400).json({ error: 'Los 3 héroes deben ser distintos' })
  }
  for (const id of heroIds) {
    if (!isUUID(id)) return res.status(400).json({ error: 'heroId inválido' })
  }

  // Cargar los 3 héroes en un solo query
  const { data: heroesRows, error: heroesErr } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at, active_effects, class, combat_rating, combats_played, combats_won, last_combat_at, tier_grace_remaining')
    .in('id', heroIds)
    .eq('player_id', user.id)

  if (heroesErr) return res.status(500).json({ error: heroesErr.message })
  if (!heroesRows || heroesRows.length !== 3) {
    return res.status(404).json({ error: 'Uno o más héroes no encontrados' })
  }

  // Mantener el orden que envió el cliente
  const heroesOrdered = heroIds.map(id => heroesRows.find(h => h.id === id)).filter(Boolean)
  if (heroesOrdered.length !== 3) {
    return res.status(404).json({ error: 'Héroes inválidos' })
  }

  const nowMs = Date.now()

  // Stats efectivas por héroe (antes de interpolar HP para usar max_hp con equipo)
  const effectiveByHero = {}
  for (const hero of heroesOrdered) {
    const baseStats = await getEffectiveStats(supabase, hero.id, user.id)
    if (!baseStats) return res.status(500).json({ error: `Sin stats para ${hero.name}` })
    effectiveByHero[hero.id] = baseStats
  }

  // Validar estado y HP mínimo de los 3
  for (const hero of heroesOrdered) {
    if (hero.status !== 'idle') {
      return res.status(409).json({ error: `${hero.name} está ocupado` })
    }
    const effMax = effectiveByHero[hero.id].max_hp
    const curHp = interpolateHP(hero, nowMs, effMax)
    if (!canPlay(curHp, effMax)) {
      return res.status(409).json({
        error: `${hero.name} tiene HP insuficiente (20% mín.)`,
        code: 'LOW_HP',
      })
    }
  }

  // Sinergia del squad del jugador
  const playerSynergy = computeSynergy(heroesOrdered.map(h => h.class))

  // Builds de combate con sinergia
  const teamA = []
  for (const hero of heroesOrdered) {
    const baseStats = effectiveByHero[hero.id]
    const withSynergy = applySynergyToStats(baseStats, playerSynergy)
    withSynergy.max_hp = baseStats.max_hp
    teamA.push({
      id:    hero.id,
      name:  hero.name,
      class: hero.class,
      stats: withSynergy,
    })
  }

  // Nivel medio del squad → rewards y generación rival
  const avgLevel = Math.max(1, Math.round(heroesOrdered.reduce((a, h) => a + h.level, 0) / 3))
  const teamB = generateEnemyTeam(avgLevel)

  // Simular
  const result = simulateTeamCombat(teamA, teamB)
  const won = result.winner === 'a'

  // Recompensas: oro pool del jugador × 3; XP por héroe × 1.5 (consistente con riesgo 3×)
  const base = trainingRewards(avgLevel)
  const goldReward = Math.round(base.gold * 3.0)
  const xpPerHero  = Math.round(base.experience * 1.5)

  // Persistir el combate (historial del squad)
  await supabase.from('team_combats').insert({
    player_id:     user.id,
    hero_ids:      teamA.map(h => h.id),
    hero_names:    teamA.map(h => h.name),
    hero_classes:  teamA.map(h => h.class),
    hero_max_hps:  teamA.map(h => h.stats.max_hp),
    enemy_names:   teamB.map(h => h.name),
    enemy_classes: teamB.map(h => h.class),
    enemy_max_hps: teamB.map(h => h.stats.max_hp),
    won,
    rounds:        result.rounds,
    log:           result.log,
    gold_reward:   won ? goldReward : 0,
    xp_reward:     won ? xpPerHero  : 0,
    synergy_bonus: playerSynergy.attackPct,
  })

  // Coste de HP por héroe — plano como el resto de modos, calculado sobre max_hp
  const costPct = won ? COMBAT_HP_COST.squad.win : COMBAT_HP_COST.squad.loss
  const nowIso = new Date(nowMs).toISOString()
  const heroUpdates = []
  const ratingResults = []

  for (const hero of heroesOrdered) {
    const effMax = effectiveByHero[hero.id].max_hp
    const curHp = interpolateHP(hero, nowMs, effMax)
    const hpAfter = applyCombatHpCost(curHp, hero.max_hp, costPct)

    const ratingResult = computeRatingUpdate(hero, {
      won,
      difficulty: teamCombatDifficulty(),
      nowMs,
    })
    ratingResults.push(ratingResult)

    heroUpdates.push({
      id: hero.id,
      current_hp:         hpAfter,
      hp_last_updated_at: nowIso,
      ...ratingResult.updates,
    })
  }

  // Aplicar updates al HP + rating en una sola query por héroe (no hay batch nativo)
  for (const upd of heroUpdates) {
    const { id, ...fields } = upd
    const { error } = await supabase
      .from('heroes')
      .update(fields)
      .eq('id', id)
      .eq('status', 'idle')
    if (error) return res.status(500).json({ error: error.message })
  }

  // Desgaste del equipo — 3v3 es duro, cada héroe sufre WEAR_PROFILE.squad.
  // La función SQL escalada aplica rareza × slot encima del amount nominal.
  for (const hero of heroesOrdered) {
    const { error: durError } = await supabase.rpc('reduce_equipment_durability_scaled', { p_hero_id: hero.id, amount: WEAR_PROFILE.squad })
    if (durError) console.error('durability rpc error:', durError.message)
  }

  // Recompensas solo si gana
  if (won) {
    // Oro + XP atómico por héroe (primer héroe recibe el oro, todos reciben XP)
    for (let i = 0; i < heroesOrdered.length; i++) {
      await supabase.rpc('reward_gold_and_xp', {
        p_player_id: user.id,
        p_hero_id:   heroesOrdered[i].id,
        p_gold:      i === 0 ? goldReward : 0,
        p_xp:        xpPerHero,
      })
    }
  }

  // Misiones
  progressMissions(supabase, user.id, 'training_combat', 1).catch(() => {})

  // Respuesta
  return res.status(200).json({
    ok: true,
    won,
    rounds:  result.rounds,
    log:     result.log,
    teamA: teamA.map((u, i) => ({
      id: u.id, name: u.name, class: u.class, max_hp: u.stats.max_hp, hp_left: result.hpLeftA[i],
    })),
    teamB: teamB.map((u, i) => ({
      name: u.name, class: u.class, max_hp: u.stats.max_hp, hp_left: result.hpLeftB[i],
    })),
    synergy: {
      player: playerSynergy,
    },
    rewards: won ? { gold: goldReward, xpPerHero } : null,
    ratings: ratingResults.map((r, i) => ({
      heroId:    heroesOrdered[i].id,
      heroName:  heroesOrdered[i].name,
      prev:      r.tierBefore.rating,
      current:   r.updates.combat_rating,
      delta:     r.delta,
      decay:     r.decayApplied,
      graceUsed: r.graceUsed,
      promoted:  r.promoted,
      tier:      r.tierAfter.tier,
      division:  r.tierAfter.division,
      label:     r.tierAfter.label,
    })),
  })
}
