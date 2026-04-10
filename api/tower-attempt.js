import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import {
  simulateCombat,
  floorEnemyStats,
  floorEnemyName,
  floorEnemyArchetype,
  applyArchetype,
  decoratedEnemyName,
} from './_combat.js'
import { interpolateHP, canPlay } from './_hp.js'
import { isUUID } from './_validate.js'
import { signCombatToken } from './_combatSign.js'
import { KEY_MOMENT_OPTIONS } from '../src/lib/combatDecisions.js'
import { finalizeTowerAttempt } from './_towerFinalize.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Obtener héroe y verificar que pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at, active_effects, class')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  // Verificar HP mínimo (20%)
  const nowMs     = Date.now()
  const currentHp = interpolateHP(hero, nowMs)
  if (!canPlay(currentHp, hero.max_hp)) {
    return res.status(409).json({
      error: `HP insuficiente. Necesitas al menos ${Math.floor(hero.max_hp * 0.2)} HP para combatir.`,
      code: 'LOW_HP',
    })
  }

  // Obtener o inicializar progreso en la torre
  let { data: progress } = await supabase
    .from('tower_progress')
    .select('max_floor')
    .eq('hero_id', hero.id)
    .maybeSingle()

  if (!progress) {
    await supabase.from('tower_progress').insert({ hero_id: hero.id, max_floor: 0 })
    progress = { max_floor: 0 }
  }

  const targetFloor = progress.max_floor + 1

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

  // Stats base del enemigo + arquetipo determinista por piso
  const baseEnemyStats = floorEnemyStats(targetFloor)
  const archetypeKey   = floorEnemyArchetype(targetFloor)
  const enemyStats     = applyArchetype(baseEnemyStats, archetypeKey)
  const enemyName      = decoratedEnemyName(floorEnemyName(targetFloor), archetypeKey)

  // Pisos múltiplos de 5 disparan "Momento clave" — pausa cuando alguien
  // baja del 50% HP, el cliente elige una decisión y se reanuda en /api/combat-resume.
  const isKeyMomentFloor = targetFloor % 5 === 0
  const combatOpts = {
    critBonus:        rb.crit_pct,
    dmgMultiplier:    rb.tower_dmg_pct,
    keyMomentEnabled: isKeyMomentFloor,
  }

  const result = simulateCombat(heroStats, enemyStats, combatOpts)

  // Si el combate se pausó por Momento clave, devolvemos el estado firmado
  // y NO finalizamos. El cliente reanudará vía /api/combat-resume con su decisión.
  if (result.paused) {
    const token = signCombatToken({
      type:         'tower',
      heroId:       hero.id,
      userId:       user.id,
      targetFloor,
      enemyName,
      archetypeKey,
      heroStats,
      enemyStats,
      state:        result.state,
      combatOpts:   { critBonus: rb.crit_pct, dmgMultiplier: rb.tower_dmg_pct },
      usedBoosts,
      prevMaxFloor: progress.max_floor,
    })
    return res.status(200).json({
      ok:            true,
      paused:        true,
      token,
      decisions:     KEY_MOMENT_OPTIONS,
      log:           result.log,
      heroHpLeft:    result.hpLeftA,
      enemyHpLeft:   result.hpLeftB,
      heroMaxHp:     heroStats.max_hp,
      enemyMaxHp:    enemyStats.max_hp,
      enemyName,
      archetype:     archetypeKey,
      floor:         targetFloor,
    })
  }

  const finalize = await finalizeTowerAttempt({
    supabase,
    user,
    hero,
    currentHp,
    heroStats,
    enemyStats,
    targetFloor,
    enemyName,
    archetypeKey,
    result,
    usedBoosts,
    nowMs,
    prevMaxFloor: progress.max_floor,
  })

  if (finalize.error) return res.status(finalize.status).json({ error: finalize.error })
  return res.status(200).json(finalize.payload)
}
