/**
 * Reanuda un combate previamente pausado por "Momento clave".
 *
 * Recibe el token firmado (HMAC) que contiene todo el estado del combate
 * y la decisión elegida por el jugador. Verifica la firma, aplica la decisión
 * a las stats del héroe (lado A) y reanuda la simulación con `resumeCombat`,
 * después finaliza usando los helpers de tower/tournament.
 */
import { requireAuth } from './_auth.js'
import { resumeCombat } from './_combat.js'
import { verifyCombatToken } from './_combatSign.js'
import { COMBAT_DECISIONS, KEY_MOMENT_OPTIONS } from '../src/lib/combatDecisions.js'
import { interpolateHP } from './_hp.js'
import { finalizeTowerAttempt } from './_towerFinalize.js'
import { finalizeTournamentFight } from './_tournamentFinalize.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { token, decision } = req.body
  if (!token)    return res.status(400).json({ error: 'token requerido' })
  if (!decision) return res.status(400).json({ error: 'decision requerida' })

  // Validar que la decisión está en el catálogo de Momento clave
  if (!KEY_MOMENT_OPTIONS.includes(decision)) {
    return res.status(400).json({ error: 'Decisión no válida' })
  }
  const decisionDef = COMBAT_DECISIONS[decision]

  // Verificar token firmado (lanza si firma inválida o expirado)
  let payload
  try {
    payload = verifyCombatToken(token)
  } catch (e) {
    return res.status(403).json({ error: e.message })
  }

  // El usuario del JWT debe coincidir con el dueño del token
  if (payload.userId !== user.id) {
    return res.status(403).json({ error: 'No autorizado' })
  }

  if (payload.type === 'tower') {
    return resumeTower(req, res, supabase, user, payload, decisionDef, decision)
  }
  if (payload.type === 'tournament') {
    return resumeTournament(req, res, supabase, user, payload, decisionDef, decision)
  }
  return res.status(400).json({ error: 'Tipo de combate desconocido' })
}

/* ─── Tower resume ───────────────────────────────────────────────────────── */

async function resumeTower(req, res, supabase, user, payload, decisionDef) {
  const { heroId, targetFloor, enemyName, archetypeKey, heroStats, enemyStats, state, combatOpts, usedBoosts, prevMaxFloor } = payload

  // Re-leer héroe (puede haber regenerado HP, etc)
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at, active_effects, class')
    .eq('id', heroId)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  const nowMs     = Date.now()
  const currentHp = interpolateHP(hero, nowMs)

  // Aplicar la decisión: modifica stats de a/b y/o hp parciales
  const applied = decisionDef.apply(heroStats, enemyStats, state.hpA, state.hpB)

  const newState = { ...state, hpA: applied.hpA, hpB: applied.hpB }

  // Reanudar combate con stats modificadas
  const result = resumeCombat(applied.a, applied.b, newState, combatOpts ?? {})

  const finalize = await finalizeTowerAttempt({
    supabase,
    user,
    hero,
    currentHp,
    heroStats:  applied.a,
    enemyStats: applied.b,
    targetFloor,
    enemyName,
    archetypeKey,
    result,
    usedBoosts,
    nowMs,
    prevMaxFloor,
  })

  if (finalize.error) return res.status(finalize.status).json({ error: finalize.error })
  return res.status(200).json(finalize.payload)
}

/* ─── Tournament resume ──────────────────────────────────────────────────── */

async function resumeTournament(req, res, supabase, user, payload, decisionDef) {
  const { heroId, bracketId, nextRound, heroStats, rival, state, combatOpts, newEffects } = payload

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, experience, level, active_effects, current_hp, max_hp, hp_last_updated_at')
    .eq('id', heroId)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const { data: bracket } = await supabase
    .from('tournament_brackets')
    .select('id, rivals, current_round, eliminated, champion')
    .eq('id', bracketId)
    .single()

  if (!bracket || bracket.eliminated || bracket.champion) {
    return res.status(409).json({ error: 'El torneo cambió de estado' })
  }
  if (bracket.current_round + 1 !== nextRound) {
    return res.status(409).json({ error: 'Ronda no válida' })
  }

  const nowMs     = Date.now()
  const currentHp = interpolateHP(hero, nowMs)

  const applied = decisionDef.apply(heroStats, rival.stats, state.hpA, state.hpB)
  const newState = { ...state, hpA: applied.hpA, hpB: applied.hpB }

  const result = resumeCombat(applied.a, applied.b, newState, combatOpts ?? {})

  // El rival mantiene sus stats originales para los registros (rival.stats)
  // pero para el cálculo se usaron las modificadas — por eso pasamos el rival original.
  const finalize = await finalizeTournamentFight({
    supabase,
    user,
    hero,
    heroStats: applied.a,
    rival,
    bracket,
    nextRound,
    result,
    currentHp,
    newEffects,
    nowMs,
  })

  return res.status(200).json(finalize.payload)
}
