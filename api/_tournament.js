/**
 * Helpers compartidos del sistema de torneos.
 */
import { ENEMY_ARCHETYPES, ARCHETYPE_KEYS, applyArchetype } from '../src/lib/gameFormulas.js'

// Nombres de rivales de torneo por arquetipo
const RIVAL_NAMES_BY_ARCHETYPE = {
  berserker: ['Gorn', 'Aldric', 'Roran', 'Drakhar', 'Brom', 'Thyra', 'Malak'],
  tank:      ['Seraphel', 'Toryn', 'Guardón', 'Vex', 'Asha', 'Mirael', 'Zelah'],
  assassin:  ['Lyria', 'Vex', 'Malak', 'Zelah', 'Asha', 'Roran', 'Thyra'],
  mage:      ['Mirael', 'Seraphel', 'Lyria', 'Zelah', 'Toryn', 'Asha', 'Aldric'],
}

// Multiplicador de dificultad por ronda
const ROUND_SCALE = { 1: 0.85, 2: 1.0, 3: 1.2 }
const ROUND_LABELS = { 1: 'Cuartos', 2: 'Semifinal', 3: 'Final' }

/**
 * Lunes de la semana del torneo (UTC) en formato 'YYYY-MM-DD'.
 * El domingo es día de pre-inscripción para la semana SIGUIENTE,
 * por eso en domingo devolvemos el lunes de mañana, no el de hace 6 días.
 */
export function getWeekStart() {
  const now = new Date()
  const day = now.getUTCDay()
  // Domingo (0) → próximo lunes (+1). Resto → lunes de esta semana (1-day).
  const diff = day === 0 ? 1 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

/** Las inscripciones solo están abiertas el domingo y el lunes (UTC). */
export function isRegistrationOpen() {
  const day = new Date().getUTCDay()
  return day === 0 || day === 1
}

/**
 * Ventanas de tiempo para cada ronda (UTC).
 * Lun (día 0): descanso / inscripciones
 * Ronda 1: martes   (día 1)
 * Mié (día 2): descanso
 * Ronda 2: jueves   (día 3)
 * Vie (día 4): descanso
 * Ronda 3: sábado   (día 5)
 * Dom (día 6): descanso
 */
export function getRoundWindows(weekStart) {
  const base = new Date(weekStart + 'T00:00:00Z').getTime()
  const day  = (n) => new Date(base + n * 86_400_000)
  return {
    1: { opens: day(1), closes: day(2), label: 'Martes'  },
    2: { opens: day(3), closes: day(4), label: 'Jueves'  },
    3: { opens: day(5), closes: day(6), label: 'Sábado'  },
  }
}

/** Ronda cuya ventana está abierta ahora (1, 2, 3 o null). */
export function getAvailableRound(weekStart) {
  const windows = getRoundWindows(weekStart)
  const now = Date.now()
  for (const [round, w] of Object.entries(windows)) {
    if (now >= w.opens.getTime() && now < w.closes.getTime()) return Number(round)
  }
  return null
}

/**
 * Comprueba si el bracket debe marcarse como eliminado por no haberse
 * presentado a una ronda cuya ventana ya cerró.
 */
export function isAutoEliminated(bracket, weekStart) {
  if (bracket.eliminated || bracket.champion) return false
  const nextRound = bracket.current_round + 1
  if (nextRound > 3) return false
  const windows = getRoundWindows(weekStart)
  const w = windows[nextRound]
  return w ? Date.now() >= w.closes.getTime() : false
}

/** PRNG determinista a partir de una semilla numérica */
function seededRand(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 5),  0x119de1f3)
    s = (s ^ (s >>> 16)) >>> 0
    return s / 0x100000000
  }
}

/** Semilla numérica a partir de heroId (UUID) + weekStart (string) */
function makeSeed(heroId, weekStart) {
  const str = heroId + weekStart
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Genera los 3 rivales de un torneo de forma determinista.
 * @param {string}   heroId
 * @param {string}   weekStart      — 'YYYY-MM-DD'
 * @param {object}   heroStats      — stats efectivas del héroe al inscribirse
 * @param {string[]} archetypePool  — arquetipos disponibles según clases desbloqueadas
 */
export function generateRivals(heroId, weekStart, heroStats, archetypePool = ARCHETYPE_KEYS) {
  const rand = seededRand(makeSeed(heroId, weekStart))

  // Elegir 3 arquetipos del pool disponible (con repetición si el pool < 3)
  const pool = [...archetypePool]
  const chosen = []
  for (let i = 0; i < 3; i++) {
    const src = pool.length >= 3 - i ? pool : [...archetypePool]
    const idx = Math.floor(rand() * src.length)
    chosen.push(src.splice(idx, 1)[0])
    if (pool.length >= 3 - i) pool.splice(pool.indexOf(chosen[chosen.length - 1]), 1)
  }

  return chosen.map((archetypeKey, i) => {
    const round = i + 1
    const scale = ROUND_SCALE[round]

    const base = {
      max_hp:       Math.round(heroStats.max_hp       * scale),
      attack:       Math.round(heroStats.attack       * scale),
      defense:      Math.round(heroStats.defense      * scale),
      strength:     Math.round(heroStats.strength     * scale),
      agility:      Math.round(heroStats.agility      * scale),
      intelligence: Math.round(heroStats.intelligence * scale),
    }
    const stats = applyArchetype(base, archetypeKey)

    const names = RIVAL_NAMES_BY_ARCHETYPE[archetypeKey] ?? ['Rival']
    const nameIdx = Math.floor(rand() * names.length)

    return {
      round,
      roundLabel:  ROUND_LABELS[round],
      name:        names[nameIdx],
      archetype:   archetypeKey,
      archetypeLabel: ENEMY_ARCHETYPES[archetypeKey]?.label ?? archetypeKey,
      stats,
    }
  })
}

/** Recompensas por ganar una ronda del torneo — solo oro y XP (maná es de edificios) */
export function tournamentRoundRewards(round, champion) {
  if (champion) {
    return { gold: 500, experience: 200, cardGuaranteed: true }
  }
  if (round === 2) return { gold: 200, experience: 100 }
  return { gold: 100, experience: 50 }
}
