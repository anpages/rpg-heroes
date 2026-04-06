/**
 * Helpers compartidos del sistema de torneos.
 */

const RIVAL_ARCHETYPES = [
  { class: 'Guerrero',  spec: 'tanque',    statBias: { defense: 1.4, max_hp: 1.3, attack: 0.8 } },
  { class: 'Asesino',  spec: 'DPS',       statBias: { attack: 1.5, agility: 1.4, defense: 0.6 } },
  { class: 'Mago',     spec: 'mágico',    statBias: { intelligence: 1.8, max_hp: 0.85, defense: 0.9 } },
  { class: 'Paladín',  spec: 'híbrido',   statBias: { defense: 1.2, strength: 1.2, max_hp: 1.1 } },
  { class: 'Berserker',spec: 'agresivo',  statBias: { attack: 1.5, strength: 1.3, defense: 0.6 } },
  { class: 'Druida',   spec: 'ágil',      statBias: { agility: 1.5, intelligence: 1.2 } },
  { class: 'Guardián', spec: 'defensor',  statBias: { defense: 1.6, max_hp: 1.5, attack: 0.7 } },
]

const RIVAL_NAMES = [
  'Aldric', 'Seraphel', 'Gorn', 'Lyria', 'Vex', 'Malak', 'Thyra',
  'Roran', 'Drakhar', 'Zelah', 'Brom', 'Asha', 'Toryn', 'Mirael',
]

// Multiplicador de dificultad por ronda
const ROUND_SCALE = { 1: 0.85, 2: 1.0, 3: 1.2 }
const ROUND_LABELS = { 1: 'Cuartos', 2: 'Semifinal', 3: 'Final' }

/** Lunes de la semana actual (UTC) en formato 'YYYY-MM-DD' */
export function getWeekStart() {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
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
 * @param {string} heroId
 * @param {string} weekStart  — 'YYYY-MM-DD'
 * @param {object} heroStats  — stats efectivas del héroe al inscribirse
 */
export function generateRivals(heroId, weekStart, heroStats) {
  const rand = seededRand(makeSeed(heroId, weekStart))

  // Elegir 3 arquetipos sin repetir
  const pool = [...RIVAL_ARCHETYPES]
  const chosen = []
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rand() * pool.length)
    chosen.push(pool.splice(idx, 1)[0])
  }

  return chosen.map((archetype, i) => {
    const round = i + 1
    const scale = ROUND_SCALE[round]
    const bias  = archetype.statBias

    const base = {
      max_hp:       heroStats.max_hp,
      attack:       heroStats.attack,
      defense:      heroStats.defense,
      strength:     heroStats.strength,
      agility:      heroStats.agility,
      intelligence: heroStats.intelligence,
    }

    const stats = {}
    for (const key of Object.keys(base)) {
      stats[key] = Math.max(1, Math.round(base[key] * scale * (bias[key] ?? 1.0)))
    }

    const nameIdx = Math.floor(rand() * RIVAL_NAMES.length)

    return {
      round,
      roundLabel: ROUND_LABELS[round],
      name:       RIVAL_NAMES[nameIdx],
      class:      archetype.class,
      spec:       archetype.spec,
      stats,
    }
  })
}

/** Recompensas por ganar una ronda del torneo */
export function tournamentRoundRewards(round, champion) {
  if (champion) {
    return { gold: 500, experience: 200, mana: 50, cardGuaranteed: true }
  }
  if (round === 2) return { gold: 200, experience: 100, mana: 20 }
  return { gold: 100, experience: 50 }
}
