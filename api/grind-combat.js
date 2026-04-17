/**
 * Combate de grindeo — PvE rápido con drops para farming activo.
 * Enemigo: misma clase que el héroe, nivel proporcional al nivel del héroe.
 * Recompensas: oro + XP siempre; fragmentos 15%, ítem 15%, táctica 8% en victoria.
 * Calidad del ítem escala con nivel del héroe (dif 2→8), sin techo de rareza.
 * Coste: 8% max_hp en victoria, 12% en derrota. Desgaste de equipo: 1 punto.
 * Momento clave: se activa cuando el cooldown llega a 0 y el combate es reñido.
 */
import { requireAuth } from './_auth.js'
import { getEffectiveStats, getFullStats } from './_stats.js'
import { simulateCombat, decoratedEnemyName } from './_combat.js'
import { interpolateHP, canPlay } from './_hp.js'
import { isUUID } from './_validate.js'
import { generateEnemyTactics } from './_enemyTactics.js'
import { signCombatToken } from './_combatSign.js'
import { KEY_MOMENT_OPTIONS } from '../src/lib/combatDecisions.js'
import { randomEnemyName } from '../src/lib/gameFormulas.js'
import { finalizeGrindCombat } from './_grindFinalize.js'

function enemyStatsFromHero(heroStats, scale = 1.0) {
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
    .select('id, name, player_id, status, level, current_hp, max_hp, hp_last_updated_at, class, grind_km_cooldown')
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

  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  const vTactics   = Math.min(21, hero.level * 3)
  const fullStats  = await getFullStats(supabase, hero.id)
  const enemyStats = enemyStatsFromHero(fullStats ?? heroStats, 1.0)
  const enemyName  = randomEnemyName(hero.level)

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

  const kmCooldown       = hero.grind_km_cooldown ?? 0
  const keyMomentEnabled = kmCooldown === 0

  const result = simulateCombat(heroStats, enemyStats, {
    critBonus:        rb.crit_pct,
    classA:           hero.class,
    classB:           hero.class,
    tacticsA:         heroTactics,
    tacticsB:         enemyTactics,
    keyMomentEnabled,
  })

  // Momento clave — devolver estado pausado con token firmado
  if (result.paused) {
    await supabase.from('heroes').update({ grind_km_cooldown: 3 }).eq('id', hero.id)
    const token = signCombatToken({
      type:       'grind',
      heroId:     hero.id,
      userId:     user.id,
      enemyName,
      heroStats,
      enemyStats,
      heroLevel:  hero.level,
      heroClass:  hero.class,
      heroMaxHp:  hero.max_hp,
      currentHp,
      state:      result.state,
      combatOpts: { critBonus: rb.crit_pct, classA: hero.class, classB: hero.class, tacticsA: heroTactics, tacticsB: enemyTactics },
    })
    return res.status(200).json({
      ok:          true,
      paused:      true,
      token,
      decisions:   KEY_MOMENT_OPTIONS,
      log:         result.log,
      heroHpLeft:  result.hpLeftA,
      enemyHpLeft: result.hpLeftB,
      heroMaxHp:   heroStats.max_hp,
      enemyMaxHp:  enemyStats.max_hp,
      enemyName,
      heroClass:   hero.class,
      enemyTactics: enemyTactics.map(t => ({ name: t.name, icon: t.icon })),
    })
  }

  // Cooldown: decrementa 1 por combate (mínimo 0)
  const kmCooldownNext = Math.max(0, kmCooldown - 1)

  const finalize = await finalizeGrindCombat({
    supabase, user, hero, currentHp, heroStats, enemyStats, enemyName, result, nowMs,
    kmCooldownNext,
  })
  if (finalize.error) return res.status(finalize.status).json({ error: finalize.error })

  return res.status(200).json({
    ...finalize.payload,
    enemyTactics: enemyTactics.map(t => ({ name: t.name, icon: t.icon })),
  })
}
