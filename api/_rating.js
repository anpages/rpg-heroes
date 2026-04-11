/**
 * Sistema de Rating de Combate (PvE).
 *
 * Solo se aplica a: torre, combate rápido y torneo.
 *
 * applyCombatResult(supabase, heroRow, { won, difficulty })
 *   heroRow debe incluir: id, combat_rating, combats_played, combats_won,
 *                         last_combat_at, tier_grace_remaining
 *   difficulty: 'trivial' | 'acorde' | 'superior'
 *
 * Devuelve el objeto con el nuevo rating, delta aplicado y tier resultante.
 */

// Deltas de puntos por combate
export const RATING_DELTA = {
  win:  { trivial: 5,  acorde: 15, superior: 25 },
  loss: -10,
}

// Decay por inactividad
export const RATING_DECAY = {
  graceDays:        3,    // no hay decay durante los primeros 3 días de inactividad
  pointsPerDay:     5,    // -5 por día adicional
}

// Gracia anti-yo-yo al promocionar
const PROMOTION_GRACE = 2

// Tramos de rating → tier / división
// Cada entrada: [minPoints, tier, division|null, label]
// Ordenada de mayor a menor para búsqueda lineal.
export const TIERS = [
  [2500, 'legend',       null, 'Leyenda'],
  [2100, 'grandmaster',  null, 'Gran Maestro'],
  [1800, 'master',       null, 'Maestro'],
  [1700, 'diamond',      1,    'Diamante I'],
  [1600, 'diamond',      2,    'Diamante II'],
  [1500, 'diamond',      3,    'Diamante III'],
  [1400, 'platinum',     1,    'Platino I'],
  [1300, 'platinum',     2,    'Platino II'],
  [1200, 'platinum',     3,    'Platino III'],
  [1100, 'gold',         1,    'Oro I'],
  [1000, 'gold',         2,    'Oro II'],
  [ 900, 'gold',         3,    'Oro III'],
  [ 800, 'silver',       1,    'Plata I'],
  [ 700, 'silver',       2,    'Plata II'],
  [ 600, 'silver',       3,    'Plata III'],
  [ 500, 'bronze',       1,    'Bronce I'],
  [ 400, 'bronze',       2,    'Bronce II'],
  [ 300, 'bronze',       3,    'Bronce III'],
  [ 200, 'iron',         1,    'Hierro I'],
  [ 100, 'iron',         2,    'Hierro II'],
  [   0, 'iron',         3,    'Hierro III'],
]

export function tierForRating(rating) {
  const r = Math.max(0, rating)
  for (const [min, tier, division, label] of TIERS) {
    if (r >= min) return { rating: r, min, tier, division, label }
  }
  return { rating: 0, min: 0, tier: 'iron', division: 3, label: 'Hierro III' }
}

/**
 * Virtual level asociado al tier/división del héroe (1..21).
 * TIERS está ordenado de mayor a menor → VL = TIERS.length - idx.
 *   Hierro III → 1   (novato)
 *   Bronce II  → 5
 *   Platino I  → 15
 *   Leyenda    → 21
 */
export function virtualLevelForRating(rating) {
  const tier = tierForRating(rating)
  const idx = TIERS.findIndex(([min]) => min === tier.min)
  if (idx < 0) return 1
  return TIERS.length - idx
}

/**
 * Virtual level para el enemigo de un quick combat, con mezcla por progreso
 * dentro del tier (estilo LoL/CS):
 *   - Tramo bajo (<34%)   → 30% de probabilidad de caer un VL por debajo
 *   - Tramo medio (34-67%) → VL exacto
 *   - Tramo alto (≥67%)   → 30% de probabilidad de subir un VL (preview
 *                           del siguiente tier cuando estás cerca de promocionar)
 *
 * Devuelve { vl, shift } donde shift ∈ {-1, 0, +1} — útil para mostrar en UI
 * "te tocó un rival del tramo superior/inferior".
 */
export function quickCombatVirtualLevel(heroRow) {
  const rating = Math.max(0, heroRow?.combat_rating ?? 0)
  const tier   = tierForRating(rating)
  const idx    = TIERS.findIndex(([min]) => min === tier.min)
  const maxVL  = TIERS.length
  const baseVL = idx < 0 ? 1 : (maxVL - idx)

  // Leyenda (idx 0): sin siguiente tier, siempre VL exacto.
  if (idx <= 0) return { vl: baseVL, shift: 0 }

  const nextMin = TIERS[idx - 1][0]
  const range   = nextMin - tier.min
  if (range <= 0) return { vl: baseVL, shift: 0 }
  const progress = (rating - tier.min) / range

  if (progress < 0.34 && Math.random() < 0.30) {
    return { vl: Math.max(1, baseVL - 1), shift: -1 }
  }
  if (progress >= 0.67 && Math.random() < 0.30) {
    return { vl: Math.min(maxVL, baseVL + 1), shift: +1 }
  }
  return { vl: baseVL, shift: 0 }
}

/**
 * Aplica el resultado de un combate al rating del héroe.
 * Gestiona decay por inactividad, gracia anti-yo-yo y promoción/democión.
 *
 * No hace la llamada de UPDATE por sí solo — devuelve los campos a escribir
 * para que el caller los aplique como parte de su propia query de heroes.
 */
export function computeRatingUpdate(heroRow, { won, difficulty = 'acorde', nowMs = Date.now() }) {
  const prevRating = heroRow.combat_rating ?? 0
  const prevPlayed = heroRow.combats_played ?? 0
  const prevWon    = heroRow.combats_won ?? 0
  const prevGrace  = heroRow.tier_grace_remaining ?? 0
  const lastAt     = heroRow.last_combat_at ? new Date(heroRow.last_combat_at).getTime() : null

  // 1) Decay por inactividad (si aplica)
  let afterDecay = prevRating
  let decayApplied = 0
  if (lastAt && prevRating > 0) {
    const daysInactive = Math.floor((nowMs - lastAt) / (24 * 3600 * 1000))
    if (daysInactive > RATING_DECAY.graceDays) {
      const extraDays = daysInactive - RATING_DECAY.graceDays
      decayApplied = Math.min(prevRating, extraDays * RATING_DECAY.pointsPerDay)
      afterDecay = prevRating - decayApplied
    }
  }

  // 2) Delta del combate
  const delta = won ? (RATING_DELTA.win[difficulty] ?? RATING_DELTA.win.acorde) : RATING_DELTA.loss

  // Tier antes del combate (tras decay) y después
  const tierBefore = tierForRating(afterDecay)
  let newRating = Math.max(0, afterDecay + delta)
  let tierAfter = tierForRating(newRating)

  // 3) Gracia anti-yo-yo: si el jugador tiene gracia y este combate lo degradaría,
  //    se hace clamp al mínimo del tier previo.
  let graceUsed = false
  if (!won && prevGrace > 0 && newRating < tierBefore.min) {
    newRating = tierBefore.min
    tierAfter = tierForRating(newRating)
    graceUsed = true
  }

  // 4) Calcular nueva gracia:
  //    - Si promocionó (subió de tier o división) → PROMOTION_GRACE
  //    - Si tenía gracia → prevGrace - 1 (se consume por combate, independientemente del resultado)
  //    - Si no → 0
  const promoted = tierAfter.min > tierBefore.min
  let newGrace
  if (promoted)              newGrace = PROMOTION_GRACE
  else if (prevGrace > 0)    newGrace = Math.max(0, prevGrace - 1)
  else                       newGrace = 0

  return {
    updates: {
      combat_rating:        newRating,
      combats_played:       prevPlayed + 1,
      combats_won:          prevWon + (won ? 1 : 0),
      last_combat_at:       new Date(nowMs).toISOString(),
      tier_grace_remaining: newGrace,
    },
    delta,
    decayApplied,
    graceUsed,
    promoted,
    tierBefore,
    tierAfter,
  }
}

/**
 * Helper para clasificar dificultad de Torre según piso vs nivel del héroe.
 * El piso se escala como "nivel equivalente" = piso (los pisos altos son duros).
 */
export function towerDifficulty(floor, heroLevel) {
  const delta = floor - heroLevel
  if (delta >= 3) return 'superior'
  if (delta <= -3) return 'trivial'
  return 'acorde'
}

/**
 * Combate rápido: dificultad basada en el RESULTADO real del combate, no en
 * el progreso del tier. Con enemigos tier-anchored, la escala de poder ya la
 * impone el tier — lo que nos dice si el jugador está en su sitio es cómo
 * terminó el combate:
 *
 *   - Paliza    (HP héroe >70%)  → superior (+25): estás por debajo del tier,
 *                                  sube rápido
 *   - Fair      (HP héroe 30-70%) → acorde   (+15): tier ajustado
 *   - Al límite (HP héroe <30%)   → trivial  (+5):  apenas sobreviviste,
 *                                  freno de escalada
 *   - Derrota                     → acorde (delta de derrota es flat -10 de
 *                                   todas formas; el valor aquí no importa)
 *
 * Así un jugador que domina escapa del low-tier en decenas de combates en vez
 * de cientos, y cuando las peleas se ajustan (HP final medio-bajo) la subida
 * se frena sola sin necesidad de tocar nada.
 */
export function quickCombatDifficulty({ won, hpLeftA, heroMaxHp }) {
  if (!won) return 'acorde'
  const pct = heroMaxHp > 0 ? hpLeftA / heroMaxHp : 0
  if (pct > 0.70) return 'superior'
  if (pct >= 0.30) return 'acorde'
  return 'trivial'
}

/**
 * Torneo: la dificultad escala por ronda.
 *   ronda 1 → trivial, ronda 2 → acorde, ronda 3 (final) → superior.
 */
export function tournamentDifficulty(round) {
  if (round >= 3) return 'superior'
  if (round <= 1) return 'trivial'
  return 'acorde'
}

/**
 * Escuadrón (3v3): arriesgas 3 héroes a la vez → siempre "superior" para
 * premiar más el éxito (×1.5 frente a un combate 1v1 "acorde").
 */
export function teamCombatDifficulty() {
  return 'superior'
}
