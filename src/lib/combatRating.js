/**
 * Sistema de rating de combate (PvE) — helpers de presentación.
 * La lógica de puntos vive en el backend (api/_rating.js).
 */

export const TIERS = [
  { min: 2500, tier: 'legend',       division: null, label: 'Leyenda',       color: '#f43f5e' },
  { min: 2100, tier: 'grandmaster',  division: null, label: 'Gran Maestro',  color: '#ef4444' },
  { min: 1800, tier: 'master',       division: null, label: 'Maestro',       color: '#b91c1c' },
  { min: 1700, tier: 'diamond',      division: 1,    label: 'Diamante I',    color: '#06b6d4' },
  { min: 1600, tier: 'diamond',      division: 2,    label: 'Diamante II',   color: '#0891b2' },
  { min: 1500, tier: 'diamond',      division: 3,    label: 'Diamante III',  color: '#0e7490' },
  { min: 1400, tier: 'platinum',     division: 1,    label: 'Platino I',     color: '#14b8a6' },
  { min: 1300, tier: 'platinum',     division: 2,    label: 'Platino II',    color: '#0d9488' },
  { min: 1200, tier: 'platinum',     division: 3,    label: 'Platino III',   color: '#0f766e' },
  { min: 1100, tier: 'gold',         division: 1,    label: 'Oro I',         color: '#f59e0b' },
  { min: 1000, tier: 'gold',         division: 2,    label: 'Oro II',        color: '#d97706' },
  { min:  900, tier: 'gold',         division: 3,    label: 'Oro III',       color: '#b45309' },
  { min:  800, tier: 'silver',       division: 1,    label: 'Plata I',       color: '#94a3b8' },
  { min:  700, tier: 'silver',       division: 2,    label: 'Plata II',      color: '#64748b' },
  { min:  600, tier: 'silver',       division: 3,    label: 'Plata III',     color: '#475569' },
  { min:  500, tier: 'bronze',       division: 1,    label: 'Bronce I',      color: '#b45309' },
  { min:  400, tier: 'bronze',       division: 2,    label: 'Bronce II',     color: '#92400e' },
  { min:  300, tier: 'bronze',       division: 3,    label: 'Bronce III',    color: '#78350f' },
  { min:  200, tier: 'iron',         division: 1,    label: 'Hierro I',      color: '#71717a' },
  { min:  100, tier: 'iron',         division: 2,    label: 'Hierro II',     color: '#52525b' },
  { min:    0, tier: 'iron',         division: 3,    label: 'Hierro III',    color: '#3f3f46' },
]

export function tierForRating(rating) {
  const r = Math.max(0, rating ?? 0)
  for (const t of TIERS) {
    if (r >= t.min) return t
  }
  return TIERS[TIERS.length - 1]
}

/**
 * Devuelve los puntos que faltan para el siguiente tier/división,
 * o null si ya está en Leyenda (sin cap).
 */
export function pointsToNextTier(rating) {
  const r = Math.max(0, rating ?? 0)
  const idx = TIERS.findIndex(t => r >= t.min)
  if (idx <= 0) return null // Leyenda → sin cap
  const next = TIERS[idx - 1]
  return next.min - r
}
