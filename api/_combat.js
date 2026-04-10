/**
 * Motor de combate reutilizable para PvE (torre, torneos) y futuro PvP.
 *
 * Determinismo:
 *   - Las fórmulas de daño, crítico y doble ataque son deterministas.
 *   - El ORDEN INICIAL de ataque (quién golpea primero) sí es probabilístico,
 *     escalado por la diferencia de agility (ver `rollFirstAttacker`).
 *   - El sistema de "Momento clave" introduce una pausa en mitad del combate
 *     cuando alguno baja del 50% HP, devolviendo el estado para que un endpoint
 *     externo aplique una decisión y reanude la simulación con `resumeCombat`.
 *
 * Fórmulas:
 *   daño físico  = max(1, round((attack + strength×0.3) × (1 − defense/(defense+60))))
 *   daño mágico  = floor(intelligence × 0.04)  → bypasa defensa
 *   doble golpe  = +1 ataque extra cada 6 rondas si ventaja de agility >= 20
 *   crítico      = cada critPeriod rondas (determinista, período basado en agility)
 *                  critPeriod = max(5, 10 − floor(agility / 10))
 *                  daño crítico = daño × 1.5
 *
 * Log devuelto: array de rondas, cada una con array de eventos individuales.
 * Cada evento: { actor:'a'|'b', damage, crit, hpA, hpB }
 */

function physDamage(atk, str, def) {
  const raw = atk + Math.floor(str * 0.3)
  const reduction = def / (def + 60)
  return Math.max(1, Math.round(raw * (1 - reduction)))
}

function magicDamage(intel) {
  return Math.floor(intel * 0.04)
}

/** Período de crítico: cada N rondas el combatiente acierta un crítico (×1.5).
 *  Soft-cap: mínimo 5 rondas entre críticos, escala más lento (cada 10 AGI). */
function critPeriod(agility) {
  return Math.max(5, 10 - Math.floor((agility ?? 0) / 10))
}

/**
 * Decide quién ataca primero en función de la diferencia de agility.
 *  - Diferencia ≥ 20  → siempre golpea primero el más rápido (skill claro).
 *  - Diferencia 5–20  → 75% favor del rápido, 25% sorpresa del lento.
 *  - Diferencia < 5   → 50/50, completamente abierto.
 *
 * Permite inyectar `rng` para tests reproducibles.
 */
export function rollFirstAttacker(agiA, agiB, rng = Math.random) {
  const diff = (agiA ?? 0) - (agiB ?? 0)
  const abs  = Math.abs(diff)
  if (abs >= 20) return diff >= 0 ? 'a' : 'b'
  if (abs >= 5) {
    const fasterIsA = diff > 0
    return rng() < 0.75 ? (fasterIsA ? 'a' : 'b') : (fasterIsA ? 'b' : 'a')
  }
  return rng() < 0.5 ? 'a' : 'b'
}

/**
 * Simula un combate entre dos combatientes desde el principio.
 * Ambos tienen: attack, defense, strength, agility, intelligence, max_hp
 * Opcionales en opts:
 *   - critBonus       (fracción extra de prob. crit, reduce período de crit de A)
 *   - dmgMultiplier   (multiplicador de daño global del lado A)
 *   - keyMomentEnabled (boolean): si true, pausa la primera vez que algún
 *     combatiente baja del 50% HP. Devuelve `paused: true` y `state` para
 *     reanudar con `resumeCombat`.
 *   - rng             (función random, para tests)
 *
 * @returns {{ winner?:'a'|'b', rounds:number, log:Round[], hpLeftA:number, hpLeftB:number, paused:boolean, state?:object }}
 * Round = { round:number, events:Event[] }
 * Event = { actor:'a'|'b', damage:number, crit:boolean, hpA:number, hpB:number }
 */
export function simulateCombat(a, b, opts = {}) {
  const firstAttacker = rollFirstAttacker(a.agility, b.agility, opts.rng)
  const initialState = {
    hpA: a.max_hp,
    hpB: b.max_hp,
    round: 0,
    log: [],
    firstAttacker,
    pauseUsed: false,
  }
  return runCombatLoop(a, b, initialState, opts)
}

/**
 * Reanuda un combate previamente pausado por "Momento clave".
 * El llamador puede pasar nuevos `a`/`b` con stats modificados por la decisión
 * y un `state.hpA`/`state.hpB` ajustado (curaciones, etc).
 */
export function resumeCombat(a, b, state, opts = {}) {
  // pauseUsed = true para que no vuelva a pausar en el mismo combate
  return runCombatLoop(a, b, { ...state, pauseUsed: true }, opts)
}

function runCombatLoop(a, b, state, opts) {
  let hpA = state.hpA
  let hpB = state.hpB
  const log = state.log
  const firstAttacker = state.firstAttacker
  const pauseUsed = !!state.pauseUsed

  const dmgMult  = 1 + (opts.dmgMultiplier ?? 0)
  const baseDmgA = Math.round((physDamage(a.attack, a.strength, b.defense) + magicDamage(a.intelligence)) * dmgMult)
  const baseDmgB = physDamage(b.attack, b.strength, a.defense) + magicDamage(b.intelligence)

  // Doble ataque: >= 20 puntos de ventaja en agility = +1 ataque extra cada 6 rondas
  const agiDiffA = Math.max(0, a.agility - b.agility)
  const agiDiffB = Math.max(0, b.agility - a.agility)
  const doubleA  = agiDiffA >= 20
  const doubleB  = agiDiffB >= 20

  // Períodos de crítico (deterministas, distintos offset para que no coincidan siempre)
  const critBonusRounds = Math.floor((opts.critBonus ?? 0) * 100)
  const critPA = Math.max(3, critPeriod(a.agility) - critBonusRounds)
  const critPB = critPeriod(b.agility)

  for (let round = state.round + 1; round <= 20 && hpA > 0 && hpB > 0; round++) {
    const events = []
    const isDoubleRound = round % 6 === 0
    const isCritA = round % critPA === 1
    const isCritB = round % critPB === (critPB > 1 ? 2 : 0)

    function strikeA() {
      if (hpB <= 0) return
      const dmg = Math.round(baseDmgA * (isCritA ? 1.5 : 1))
      hpB = Math.max(0, hpB - dmg)
      events.push({ actor: 'a', damage: dmg, crit: isCritA, hpA, hpB })
    }

    function strikeB() {
      if (hpA <= 0) return
      const dmg = Math.round(baseDmgB * (isCritB ? 1.5 : 1))
      hpA = Math.max(0, hpA - dmg)
      events.push({ actor: 'b', damage: dmg, crit: isCritB, hpA, hpB })
    }

    if (firstAttacker === 'a') {
      strikeA()
      if (doubleA && isDoubleRound) strikeA()
      strikeB()
      if (doubleB && isDoubleRound) strikeB()
    } else {
      strikeB()
      if (doubleB && isDoubleRound) strikeB()
      strikeA()
      if (doubleA && isDoubleRound) strikeA()
    }

    log.push({ round, events })

    // Comprobar pausa por "Momento clave" tras la ronda completa.
    // Solo se dispara una vez por combate y solo si keyMomentEnabled = true.
    if (
      opts.keyMomentEnabled &&
      !pauseUsed &&
      hpA > 0 && hpB > 0 &&
      (hpA / a.max_hp <= 0.5 || hpB / b.max_hp <= 0.5)
    ) {
      return {
        paused:  true,
        rounds:  log.length,
        log,
        hpLeftA: hpA,
        hpLeftB: hpB,
        state: {
          hpA,
          hpB,
          round,
          log,
          firstAttacker,
          pauseUsed: true,
        },
      }
    }

    if (hpA <= 0 || hpB <= 0) break
  }

  // Empate tras 20 rondas: gana quien tenga mayor % de HP
  let winner
  if      (hpA > 0 && hpB <= 0) winner = 'a'
  else if (hpB > 0 && hpA <= 0) winner = 'b'
  else winner = (hpA / a.max_hp) >= (hpB / b.max_hp) ? 'a' : 'b'

  return {
    winner,
    rounds:  log.length,
    log,
    hpLeftA: Math.max(0, hpA),
    hpLeftB: Math.max(0, hpB),
    paused:  false,
  }
}

// Fórmulas compartidas con el frontend — fuente de verdad en gameFormulas.js
export {
  floorEnemyStats,
  floorRewards,
  floorEnemyName,
  floorEnemyArchetype,
  applyArchetype,
  ENEMY_ARCHETYPES,
  decoratedEnemyName,
} from '../src/lib/gameFormulas.js'
