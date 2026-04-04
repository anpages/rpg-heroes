/**
 * Motor de combate reutilizable para PvE (torre) y futuro PvP.
 * Completamente determinista — sin RNG, mismo resultado para mismos stats.
 *
 * Fórmulas:
 *   daño físico  = max(1, round((attack + strength×0.3) × (1 − defense/(defense+60))))
 *   daño mágico  = floor(intelligence × 0.04)  → bypasa defensa
 *   velocidad    = cada 15 puntos de ventaja en agility = 1 ataque extra cada 4 turnos
 */

function physDamage(atk, str, def) {
  const raw = atk + Math.floor(str * 0.3)
  const reduction = def / (def + 60)
  return Math.max(1, Math.round(raw * (1 - reduction)))
}

function magicDamage(intel) {
  return Math.floor(intel * 0.04)
}

/**
 * Simula un combate entre dos combatientes.
 * Ambos tienen: attack, defense, strength, agility, intelligence, max_hp
 * Devuelve: { winner: 'a'|'b', rounds, log, hpLeftA, hpLeftB }
 */
export function simulateCombat(a, b) {
  let hpA = a.max_hp
  let hpB = b.max_hp
  const log = []

  const dmgA = physDamage(a.attack, a.strength, b.defense) + magicDamage(a.intelligence)
  const dmgB = physDamage(b.attack, b.strength, a.defense) + magicDamage(b.intelligence)

  // Velocidad extra: cada 15 de ventaja en agility = 1 ataque extra cada 4 turnos
  const agiDiffA = Math.max(0, a.agility - b.agility)
  const agiDiffB = Math.max(0, b.agility - a.agility)
  const extraFreqA = agiDiffA >= 15 ? Math.floor(agiDiffA / 15) : 0
  const extraFreqB = agiDiffB >= 15 ? Math.floor(agiDiffB / 15) : 0

  // Orden de actuación: mayor agility golpea primero
  const aFirst = a.agility >= b.agility

  for (let round = 1; round <= 30 && hpA > 0 && hpB > 0; round++) {
    const extraA = extraFreqA > 0 && round % 4 === 0 ? extraFreqA : 0
    const extraB = extraFreqB > 0 && round % 4 === 0 ? extraFreqB : 0

    const totalDmgA = dmgA * (1 + extraA)
    const totalDmgB = dmgB * (1 + extraB)

    if (aFirst) {
      hpB = Math.max(0, hpB - totalDmgA)
      if (hpB > 0) hpA = Math.max(0, hpA - totalDmgB)
    } else {
      hpA = Math.max(0, hpA - totalDmgB)
      if (hpA > 0) hpB = Math.max(0, hpB - totalDmgA)
    }

    log.push({ round, hpA, hpB, dmgA: totalDmgA, dmgB: totalDmgB })
    if (hpA <= 0 || hpB <= 0) break
  }

  // Si ambos siguen vivos tras 30 rondas, gana quien tenga mayor % de HP
  let winner
  if (hpA > 0 && hpB <= 0) winner = 'a'
  else if (hpB > 0 && hpA <= 0) winner = 'b'
  else winner = (hpA / a.max_hp) >= (hpB / b.max_hp) ? 'a' : 'b'

  return { winner, rounds: log.length, log, hpLeftA: hpA, hpLeftB: hpB }
}

/**
 * Genera las stats del enemigo de un piso de la torre.
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
