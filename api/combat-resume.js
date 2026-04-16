/**
 * Reanuda un combate de Torre previamente pausado por "Momento clave".
 *
 * Recibe el token firmado (HMAC) con todo el estado del combate
 * y la decisión elegida por el jugador. Verifica la firma, aplica la decisión
 * a las stats del héroe y reanuda la simulación con `resumeCombat`.
 */
import { requireAuth } from './_auth.js'
import { resumeCombat } from './_combat.js'
import { verifyCombatToken } from './_combatSign.js'
import { COMBAT_DECISIONS, KEY_MOMENT_OPTIONS } from '../src/lib/combatDecisions.js'
import { interpolateHP } from './_hp.js'
import { finalizeTowerAttempt } from './_towerFinalize.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { token, decision } = req.body
  if (!token)    return res.status(400).json({ error: 'token requerido' })
  if (!decision) return res.status(400).json({ error: 'decision requerida' })

  if (!KEY_MOMENT_OPTIONS.includes(decision)) {
    return res.status(400).json({ error: 'Decisión no válida' })
  }
  const decisionDef = COMBAT_DECISIONS[decision]

  let payload
  try {
    payload = verifyCombatToken(token)
  } catch (e) {
    return res.status(403).json({ error: e.message })
  }

  if (payload.userId !== user.id) {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (payload.type !== 'tower') {
    return res.status(400).json({ error: 'Tipo de combate desconocido' })
  }

  const { heroId, targetFloor, enemyName, archetypeKey, heroStats, enemyStats, state, combatOpts, usedBoosts, prevMaxFloor } = payload

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at, active_effects, class')
    .eq('id', heroId)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  const nowMs     = Date.now()
  const currentHp = interpolateHP(hero, nowMs, heroStats.max_hp)

  const applied  = decisionDef.apply(heroStats, enemyStats, state.hpA, state.hpB)
  const newState = { ...state, hpA: applied.hpA, hpB: applied.hpB }
  const result   = resumeCombat(applied.a, applied.b, newState, combatOpts ?? {})

  const finalize = await finalizeTowerAttempt({
    supabase, user, hero, currentHp,
    heroStats:  applied.a,
    enemyStats: applied.b,
    targetFloor, enemyName, archetypeKey,
    result, usedBoosts, nowMs, prevMaxFloor,
  })

  if (finalize.error) return res.status(finalize.status).json({ error: finalize.error })
  return res.status(200).json(finalize.payload)
}
