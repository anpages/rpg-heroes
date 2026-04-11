/**
 * Motor de combate 3v3 (Escuadrón).
 *
 * Diseño:
 *   - Cola de iniciativa por agility: todos los combatientes actúan una vez
 *     por ronda en orden descendente de agilidad.
 *   - Targeting por rol:
 *       tank     → enemigo frontal con más HP (aggro al rival más amenazante)
 *       mage     → enemigo con menos defensa (rompe armaduras)
 *       ranger   → enemigo con menor HP actual (remata)
 *       assassin → prioriza retaguardia rival; si no queda back, al más blando
 *   - Protección de línea frontal:
 *       mientras el rival tenga al menos un tanque vivo, los DPS (mage/ranger)
 *       no pueden atacar la retaguardia — pegan al frente.
 *       Los asesinos IGNORAN esta regla (bypass).
 *   - Crit determinista por agility (mismo `critPeriod` que 1v1).
 *   - 30 rondas máximo (más que 1v1 por haber 6 combatientes).
 *   - Desempate por % total de HP restante.
 *
 * Log devuelto: array de rondas, cada una con events [{ actor, target, damage,
 * crit, hps: { a0..a2, b0..b2 } }]. `actor`/`target` son claves estables del
 * tipo `a0`, `a1`, `a2`, `b0`, `b1`, `b2` para que el replay pueda mapearlas.
 */

import { physDamage, magicDamage, critPeriod } from './_combatMath.js'
import { roleForClass } from '../src/lib/teamSynergy.js'

const MAX_ROUNDS = 30

function snapshotHps(fighters) {
  const out = {}
  for (const f of fighters) out[f.key] = f.hp
  return out
}

function pickTarget(attacker, enemies) {
  const alive = enemies.filter(e => e.hp > 0)
  if (alive.length === 0) return null

  // Asesino: salta a la retaguardia enemiga siempre que exista.
  if (attacker.role === 'assassin') {
    const back = alive.filter(e => e.line === 'back')
    if (back.length > 0) {
      return back.slice().sort((x, y) => x.hp - y.hp)[0]
    }
    return alive.slice().sort((x, y) => x.hp - y.hp)[0]
  }

  // Resto: frontline protection mientras haya tanques rivales.
  const enemyTankAlive = alive.some(e => e.role === 'tank')
  const candidates = enemyTankAlive ? alive.filter(e => e.line === 'front') : alive
  if (candidates.length === 0) return alive[0]

  if (attacker.role === 'tank') {
    // Tanque: pega al enemigo frontal con más HP → aguanta el cambio.
    return candidates.slice().sort((x, y) => y.hp - x.hp)[0]
  }

  if (attacker.role === 'mage') {
    // Mago: al de menor defensa.
    return candidates.slice().sort((x, y) => (x.stats.defense ?? 0) - (y.stats.defense ?? 0))[0]
  }

  if (attacker.role === 'ranger') {
    // Arquero: remata al más herido.
    return candidates.slice().sort((x, y) => x.hp - y.hp)[0]
  }

  // Fallback: el más débil.
  return candidates.slice().sort((x, y) => x.hp - y.hp)[0]
}

function buildFighter(side, idx, unit) {
  const roleInfo = roleForClass(unit.class)
  return {
    key:   `${side}${idx}`,
    side,
    idx,
    id:    unit.id ?? null,
    name:  unit.name,
    class: unit.class,
    role:  roleInfo.role,
    line:  roleInfo.line,
    stats: unit.stats,
    hp:    unit.stats.max_hp,
  }
}

/**
 * @param {Array<{id?, name, class, stats}>} teamA  3 héroes del jugador con stats efectivos
 * @param {Array<{name, class, stats}>} teamB       3 enemigos generados
 * @param {object} opts
 * @returns {{ winner: 'a'|'b', rounds: number, log: object[], hpLeftA: number[], hpLeftB: number[] }}
 */
export function simulateTeamCombat(teamA, teamB) {
  const fighters = [
    ...teamA.map((u, i) => buildFighter('a', i, u)),
    ...teamB.map((u, i) => buildFighter('b', i, u)),
  ]

  // Orden de iniciativa por agility desc; desempate: jugador antes que enemigo.
  const initiative = fighters.slice().sort((x, y) => {
    const ag = (y.stats.agility ?? 0) - (x.stats.agility ?? 0)
    if (ag !== 0) return ag
    return x.side === 'a' ? -1 : 1
  })

  const log = []

  outer: for (let round = 1; round <= MAX_ROUNDS; round++) {
    const events = []

    for (const attacker of initiative) {
      if (attacker.hp <= 0) continue

      const enemies = fighters.filter(f => f.side !== attacker.side)
      if (!enemies.some(e => e.hp > 0)) break

      const target = pickTarget(attacker, enemies)
      if (!target) continue

      const base = physDamage(attacker.stats.attack, attacker.stats.strength, target.stats.defense)
                 + magicDamage(attacker.stats.intelligence)
      const cp = critPeriod(attacker.stats.agility)
      const isCrit = round % cp === 0
      const dmg = Math.max(1, Math.round(base * (isCrit ? 1.5 : 1)))
      target.hp = Math.max(0, target.hp - dmg)

      events.push({
        actor:  attacker.key,
        target: target.key,
        damage: dmg,
        crit:   isCrit,
        hps:    snapshotHps(fighters),
      })

      const allies = fighters.filter(f => f.side === attacker.side)
      const aAlive = allies.some(e => e.hp > 0)
      const bAlive = enemies.some(e => e.hp > 0)
      if (!aAlive || !bAlive) {
        log.push({ round, events })
        break outer
      }
    }

    log.push({ round, events })

    const aAlive = fighters.some(f => f.side === 'a' && f.hp > 0)
    const bAlive = fighters.some(f => f.side === 'b' && f.hp > 0)
    if (!aAlive || !bAlive) break
  }

  function totalPct(side) {
    const team = fighters.filter(f => f.side === side)
    const cur  = team.reduce((acc, f) => acc + Math.max(0, f.hp), 0)
    const max  = team.reduce((acc, f) => acc + f.stats.max_hp, 0)
    return max > 0 ? cur / max : 0
  }

  const aPct = totalPct('a')
  const bPct = totalPct('b')
  let winner
  if (aPct === 0 && bPct === 0) winner = 'b'
  else if (aPct === 0)          winner = 'b'
  else if (bPct === 0)          winner = 'a'
  else                          winner = aPct >= bPct ? 'a' : 'b'

  return {
    winner,
    rounds:  log.length,
    log,
    hpLeftA: fighters.filter(f => f.side === 'a').map(f => f.hp),
    hpLeftB: fighters.filter(f => f.side === 'b').map(f => f.hp),
  }
}
