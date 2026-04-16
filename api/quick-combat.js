/**
 * Simulador de combate — sin coste de HP, sin recompensas, sin desgaste.
 * Sirve para probar builds de tácticas y estrategia antes de la Torre o PvP.
 */
import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat } from './_combat.js'
import { enemyStatsForLevel } from '../src/lib/gameFormulas.js'
import { isUUID } from './_validate.js'
import { COMBAT_STRATEGIES } from '../src/lib/gameConstants.js'
import { generateCounterTactics } from './_enemyTactics.js'
import { verifyCombatToken } from './_combatSign.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, previewToken, strategy: bodyStrategy } = req.body
  if (!heroId)          return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId))  return res.status(400).json({ error: 'heroId inválido' })
  if (!previewToken)    return res.status(400).json({ error: 'previewToken requerido' })

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
    .select('id, name, player_id, status, level, current_hp, max_hp, hp_last_updated_at, active_effects, class, combat_strategy')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  const heroStats = await getEffectiveStats(supabase, hero.id, user.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

  // Estrategia del héroe — afecta al resultado pero no tiene coste
  const strategyKey = (bodyStrategy && COMBAT_STRATEGIES[bodyStrategy]) ? bodyStrategy : (hero.combat_strategy ?? 'balanced')
  const strategy = COMBAT_STRATEGIES[strategyKey]
  heroStats.attack  = Math.round(heroStats.attack  * strategy.atkMult)
  heroStats.defense = Math.round(heroStats.defense * strategy.defMult)

  // Consumibles activos — se aplican al resultado pero NO se consumen (es simulación)
  const effects = hero.active_effects ?? {}
  if (effects.atk_boost) heroStats.attack  = Math.round(heroStats.attack  * (1 + effects.atk_boost))
  if (effects.def_boost) heroStats.defense = Math.round(heroStats.defense * (1 + effects.def_boost))

  // Bonos de investigación
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  const { archetypeKey, enemyName } = preview
  const vl = Math.max(1, Math.min(21, Math.ceil(hero.level * 21 / 50)))

  // Enemigo de la misma clase — combate espejo
  const enemyStats = enemyStatsForLevel(hero.class, vl)
  const ARCHETYPE_STRATEGY = { berserker: 'aggressive', assassin: 'aggressive', tank: 'defensive', mage: 'balanced' }
  const enemyStrategy = COMBAT_STRATEGIES[ARCHETYPE_STRATEGY[archetypeKey] ?? 'balanced']
  enemyStats.attack  = Math.round(enemyStats.attack  * enemyStrategy.atkMult)
  enemyStats.defense = Math.round(enemyStats.defense * enemyStrategy.defMult)

  // Tácticas
  const { data: heroTacticRows } = await supabase
    .from('hero_tactics')
    .select('level, tactic_catalog(name, icon, combat_effect)')
    .eq('hero_id', heroId)
    .not('slot_index', 'is', null)
  const heroTactics = (heroTacticRows ?? []).filter(r => r.tactic_catalog).map(r => ({
    name: r.tactic_catalog.name, icon: r.tactic_catalog.icon,
    level: r.level, combat_effect: r.tactic_catalog.combat_effect,
  }))
  const enemyTactics = generateCounterTactics(vl, archetypeKey, heroStats)

  const result = simulateCombat(heroStats, enemyStats, {
    critBonus:        rb.crit_pct,
    classA:           hero.class,
    classB:           preview.enemyClass,
    tacticsA:         heroTactics,
    tacticsB:         enemyTactics,
    critBoostRoundsA: effects.crit_boost    ?? 0,
    armorPenBonusA:   effects.armor_pen     ?? 0,
    initialDodgeA:    !!effects.combat_shield,
    lifeStealA:       effects.lifesteal_pct ?? 0,
  })

  const won = result.winner === 'a'

  // Sin recompensas, sin coste de HP, sin desgaste de equipo — es solo simulación
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
    durabilityLoss: 0,
    enemyTactics: enemyTactics.map(t => ({ name: t.name, icon: t.icon })),
    rewards:      null,
    heroCurrentHp:  hero.current_hp,
    heroRealMaxHp:  hero.max_hp,
  })
}
