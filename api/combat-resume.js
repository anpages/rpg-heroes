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
import { finalizeGrindCombat } from './_grindFinalize.js'

/** IA del enemigo: elige decisión según su HP actual */
function enemyAIDecision(enemyStats, hpB) {
  const hpPct = hpB / enemyStats.max_hp
  // Pesos: [estocada_final, defensa_ferrea, concentracion_arcana, impulso_veloz]
  const weights = hpPct < 0.35
    ? [0.10, 0.50, 0.15, 0.25]   // HP bajo: prioriza defensa/curación
    : hpPct > 0.65
      ? [0.35, 0.10, 0.30, 0.25]  // HP alto: más agresivo
      : [0.25, 0.25, 0.25, 0.25]  // equilibrado
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < KEY_MOMENT_OPTIONS.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return KEY_MOMENT_OPTIONS[i]
  }
  return KEY_MOMENT_OPTIONS[0]
}

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

  const { heroId, heroStats, enemyStats, state, combatOpts } = payload

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

  // Decisión del jugador aplicada al héroe (lado A)
  const playerApplied = decisionDef.apply(heroStats, enemyStats, state.hpA, state.hpB)

  // Decisión de la IA del enemigo aplicada al enemigo (tratado como lado A)
  const enemyDecisionKey = enemyAIDecision(enemyStats, state.hpB)
  const enemyDecisionDef = COMBAT_DECISIONS[enemyDecisionKey]
  const enemyApplied = enemyDecisionDef.apply(
    playerApplied.b,   // enemy stats
    playerApplied.a,   // hero stats (como "b", no se modifica)
    playerApplied.hpB, // enemy HP
    playerApplied.hpA, // hero HP
  )

  const newState = { ...state, hpA: enemyApplied.hpB, hpB: enemyApplied.hpA }
  const result   = resumeCombat(playerApplied.a, enemyApplied.a, newState, combatOpts ?? {})

  // ── Torre ────────────────────────────────────────────────────────────────────
  if (payload.type === 'tower') {
    const { targetFloor, enemyName, archetypeKey, prevMaxFloor } = payload
    const finalize = await finalizeTowerAttempt({
      supabase, user, hero, currentHp,
      heroStats:  playerApplied.a,
      enemyStats: enemyApplied.a,
      targetFloor, enemyName, archetypeKey,
      result, nowMs, prevMaxFloor,
    })
    if (finalize.error) return res.status(finalize.status).json({ error: finalize.error })
    return res.status(200).json({
      ...finalize.payload,
      playerDecision: decision,
      enemyDecision:  enemyDecisionKey,
    })
  }

  // ── Grindeo ──────────────────────────────────────────────────────────────────
  if (payload.type === 'grind') {
    const { enemyName } = payload
    const finalize = await finalizeGrindCombat({
      supabase, user, hero, currentHp,
      heroStats:  playerApplied.a,
      enemyStats: enemyApplied.a,
      enemyName, result, nowMs,
      kmCooldownNext: 3, // ya se puso a 3 cuando se pausó, aquí se mantiene hasta que baje
    })
    if (finalize.error) return res.status(finalize.status).json({ error: finalize.error })
    return res.status(200).json({
      ...finalize.payload,
      enemyTactics:   [],
      playerDecision: decision,
      enemyDecision:  enemyDecisionKey,
    })
  }

  return res.status(400).json({ error: 'Tipo de combate desconocido' })
}
