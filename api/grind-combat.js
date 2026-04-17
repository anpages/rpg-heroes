/**
 * Combate de grindeo — PvE rápido con drops para farming activo.
 * Enemigo: misma clase que el héroe, nivel proporcional al nivel del héroe.
 * Recompensas: oro + XP siempre; fragmentos 15%, ítem 15%, táctica 8% en victoria.
 * Calidad del ítem escala con nivel del héroe (dif 2→8), sin techo de rareza.
 * Coste: 8% max_hp en victoria, 12% en derrota. Desgaste de equipo: 1 punto.
 */
import { requireAuth } from './_auth.js'
import { getEffectiveStats, getFullStats } from './_stats.js'
import { simulateCombat, floorEnemyName, decoratedEnemyName } from './_combat.js'
import { interpolateHP, applyCombatHpCost, canPlay } from './_hp.js'
import { isUUID } from './_validate.js'
import { generateEnemyTactics } from './_enemyTactics.js'
import { rollItemDrop, rollTacticDrop, getDropConfig } from './_loot.js'
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'

/**
 * Dificultad de drop según nivel del héroe.
 * Controla la distribución de rareza y tier — la tasa del 15% se normaliza aparte.
 * Nv.1-5:  dif 2 → tier 1, sin épica
 * Nv.6-12: dif 4 → tier 1-2, sin épica
 * Nv.13-20: dif 6 → tier 1-2, épica ~7%
 * Nv.21-30: dif 7 → tier 2-3, épica ~12%, legendaria ~2%
 * Nv.31+:   dif 8 → tier 2-3, épica ~17%, legendaria ~5%
 */
function grindDropDifficulty(level) {
  if (level <= 5)  return 2
  if (level <= 12) return 4
  if (level <= 20) return 6
  if (level <= 30) return 7
  return 8
}

/** Enemy stats derivados de las stats reales del héroe × escalar */
function enemyStatsFromHero(heroStats, scale = 0.85) {
  return {
    max_hp:       Math.max(1, Math.round(heroStats.max_hp       * scale)),
    attack:       Math.max(1, Math.round(heroStats.attack       * scale)),
    defense:      Math.max(1, Math.round(heroStats.defense      * scale)),
    strength:     Math.max(1, Math.round(heroStats.strength     * scale)),
    agility:      Math.max(1, Math.round(heroStats.agility      * scale)),
    intelligence: Math.max(1, Math.round(heroStats.intelligence * scale)),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, level, current_hp, max_hp, hp_last_updated_at, class')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  const heroStats = await getEffectiveStats(supabase, hero.id, user.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

  const nowMs     = Date.now()
  const currentHp = interpolateHP(hero, nowMs, heroStats.max_hp)
  if (!canPlay(currentHp, heroStats.max_hp)) {
    return res.status(409).json({
      error: `HP insuficiente. Necesitas al menos ${Math.floor(heroStats.max_hp * 0.2)} HP para combatir.`,
      code: 'LOW_HP',
    })
  }

  // Bonos de investigación
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  // Enemigo anclado a stats a durabilidad 100% — el desgaste penaliza al héroe
  const vFloor      = Math.max(1, hero.level)
  const vTactics    = Math.min(21, hero.level * 3)
  const fullStats   = await getFullStats(supabase, hero.id)
  const enemyStats  = enemyStatsFromHero(fullStats ?? heroStats, 1.0)
  const enemyBase   = floorEnemyName(vFloor)
  const enemyName   = decoratedEnemyName(enemyBase, hero.class)

  // Tácticas del héroe
  const { data: heroTacticRows } = await supabase
    .from('hero_tactics')
    .select('level, tactic_catalog(name, icon, combat_effect)')
    .eq('hero_id', heroId)
    .not('slot_index', 'is', null)
  const heroTactics = (heroTacticRows ?? []).filter(r => r.tactic_catalog).map(r => ({
    name: r.tactic_catalog.name, icon: r.tactic_catalog.icon,
    level: r.level, combat_effect: r.tactic_catalog.combat_effect,
  }))
  const enemyTactics = generateEnemyTactics(vTactics, hero.class)

  const result = simulateCombat(heroStats, enemyStats, {
    critBonus: rb.crit_pct,
    classA:    hero.class,
    classB:    hero.class,
    tacticsA:  heroTactics,
    tacticsB:  enemyTactics,
  })

  const won = result.winner === 'a'

  // Deducir HP
  const costPct       = won ? COMBAT_HP_COST.grind.win : COMBAT_HP_COST.grind.loss
  const hpAfterCombat = applyCombatHpCost(currentHp, heroStats.max_hp, costPct)

  const { error: hpError, count: hpCount } = await supabase
    .from('heroes')
    .update({
      current_hp:         hpAfterCombat,
      hp_last_updated_at: new Date(nowMs).toISOString(),
    })
    .eq('id', hero.id)
    .eq('status', 'idle')

  if (hpError)       return { error: hpError.message, status: 500 }
  if (hpCount === 0) return res.status(409).json({ error: 'El héroe cambió de estado durante el combate' })

  // Reducir durabilidad: 1 punto fijo (como torre piso 1-10)
  await supabase.rpc('reduce_equipment_durability_scaled', { p_hero_id: hero.id, amount: 1 })

  // Recompensas
  const gold = won
    ? 20 + Math.floor(Math.random() * 21)   // 20-40
    : 5  + Math.floor(Math.random() * 8)    // 5-12
  const xp = won
    ? 30 + Math.floor(Math.random() * 21)   // 30-50
    : 10 + Math.floor(Math.random() * 11)   // 10-20

  const { data: rpcResult, error: rpcError } = await supabase.rpc('reward_gold_and_xp', {
    p_player_id: user.id,
    p_hero_id:   hero.id,
    p_gold:      gold,
    p_xp:        xp,
  })
  if (rpcError) return res.status(500).json({ error: rpcError.message })

  let fragments = 0
  let drop      = null
  let tactic    = null

  if (won) {
    // Fragmentos: 15% → 1-3
    if (Math.random() < 0.15) {
      fragments = 1 + Math.floor(Math.random() * 3)
      await supabase.rpc('add_resources', {
        p_player_id: user.id,
        p_gold:      0,
        p_fragments: fragments,
        p_essence:   0,
      })
    }

    // Ítem: 15% fijo — calidad escala con nivel del héroe
    const dropDif  = grindDropDifficulty(hero.level)
    const dropMult = 0.15 / getDropConfig(dropDif).chance  // normaliza a 15% real
    drop = await rollItemDrop(supabase, hero.id, user.id, {
      difficulty:   dropDif,
      poolKey:      'combat',
      heroClass:    hero.class,
      dropRateMult: dropMult,
    })

    // Táctica: 8%
    if (Math.random() < 0.08) {
      tactic = await rollTacticDrop(supabase, hero.id, hero.class, { chance: 1.0 })
    }
  }

  // Historial genérico + contadores de combate
  await supabase.from('combat_log').insert({
    hero_id:    hero.id,
    player_id:  user.id,
    source:     'grind',
    won,
    enemy_name: enemyName,
    rounds:     result.rounds,
  })
  await supabase.rpc('increment_combat_stats', { p_hero_id: hero.id, p_won: won })

  return res.status(200).json({
    ok: true,
    won,
    rounds:        result.rounds,
    log:           result.log,
    heroHpLeft:    result.hpLeftA,
    enemyHpLeft:   result.hpLeftB,
    heroMaxHp:     heroStats.max_hp,
    enemyMaxHp:    enemyStats.max_hp,
    enemyName,
    heroClass:     hero.class,
    enemyTactics:  enemyTactics.map(t => ({ name: t.name, icon: t.icon })),
    rewards: {
      gold,
      experience: xp,
      fragments:  fragments || null,
      drop:       drop ?? null,
      tactic:     tactic ?? null,
      levelUp:    rpcResult?.level_up ?? false,
    },
    heroCurrentHp: hpAfterCombat,
    heroRealMaxHp: hero.max_hp,
  })
}
