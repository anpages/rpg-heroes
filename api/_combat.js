/**
 * Motor de combate reutilizable para PvE (torre, torneos) y futuro PvP.
 * Completamente determinista — mismo resultado para mismos stats.
 *
 * Fórmulas:
 *   daño físico  = max(1, round((attack + strength×0.3) × (1 − defense/(defense+60))))
 *   daño mágico  = floor(intelligence × 0.04)  → bypasa defensa
 *   velocidad    = cada 15 puntos de ventaja en agility = ataque doble cada 4 rondas
 *   crítico      = cada critPeriod rondas (determinista, período basado en agility)
 *                  critPeriod = max(4, 10 − floor(agility / 8))
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

/** Período de crítico: cada N rondas el combatiente acierta un crítico (×1.5). */
function critPeriod(agility) {
  return Math.max(4, 10 - Math.floor((agility ?? 0) / 8))
}

/**
 * Simula un combate entre dos combatientes.
 * Ambos tienen: attack, defense, strength, agility, intelligence, max_hp
 *
 * @returns {{ winner:'a'|'b', rounds:number, log:Round[], hpLeftA:number, hpLeftB:number }}
 * Round = { round:number, events:Event[] }
 * Event = { actor:'a'|'b', damage:number, crit:boolean, hpA:number, hpB:number }
 */
export function simulateCombat(a, b) {
  let hpA = a.max_hp
  let hpB = b.max_hp
  const log = []

  const baseDmgA = physDamage(a.attack, a.strength, b.defense) + magicDamage(a.intelligence)
  const baseDmgB = physDamage(b.attack, b.strength, a.defense) + magicDamage(b.intelligence)

  // Doble ataque: cada 15 puntos de ventaja en agility = +1 ataque extra cada 4 rondas
  const agiDiffA = Math.max(0, a.agility - b.agility)
  const agiDiffB = Math.max(0, b.agility - a.agility)
  const doubleA = agiDiffA >= 15
  const doubleB = agiDiffB >= 15

  // Orden: mayor agility ataca primero
  const aFirst = a.agility >= b.agility

  // Períodos de crítico (deterministas, distintos offset para que no coincidan siempre)
  const critPA = critPeriod(a.agility)
  const critPB = critPeriod(b.agility)

  for (let round = 1; round <= 30 && hpA > 0 && hpB > 0; round++) {
    const events = []
    const isDoubleRound = round % 4 === 0
    const isCritA = round % critPA === 1          // offset 1 para A
    const isCritB = round % critPB === (critPB > 1 ? 2 : 0)  // offset 2 para B (evita coincidencia exacta)

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

    if (aFirst) {
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
    if (hpA <= 0 || hpB <= 0) break
  }

  // Empate tras 30 rondas: gana quien tenga mayor % de HP
  let winner
  if      (hpA > 0 && hpB <= 0) winner = 'a'
  else if (hpB > 0 && hpA <= 0) winner = 'b'
  else winner = (hpA / a.max_hp) >= (hpB / b.max_hp) ? 'a' : 'b'

  return {
    winner,
    rounds:   log.length,
    log,
    hpLeftA:  Math.max(0, hpA),
    hpLeftB:  Math.max(0, hpB),
  }
}

/**
 * Stats del enemigo de un piso de la torre.
 * Escalado calibrado para requerir equipo progresivo.
 */
export function floorEnemyStats(floor) {
  return {
    max_hp:       80  + floor * 15,
    attack:        5  + floor * 2,
    defense:       2  + floor * 1,
    strength:      2  + Math.floor(floor * 0.5),
    agility:       2  + Math.floor(floor * 0.3),
    intelligence:  1  + Math.floor(floor * 0.3),
  }
}

/**
 * Recompensas por superar un piso.
 * Pisos múltiplo de 5 = hito con bonus ×2.
 */
export function floorRewards(floor) {
  const milestone = floor % 5 === 0
  return {
    gold:       Math.round((30 + floor * 15) * (milestone ? 2 : 1)),
    experience: Math.round((20 + floor * 10) * (milestone ? 2 : 1)),
    milestone,
  }
}
