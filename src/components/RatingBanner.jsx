import { Shield, ShieldCheck, TrendingDown, Swords } from 'lucide-react'
import { tierForRating, pointsToNextTier, TIERS } from '../lib/combatRating'

function daysBetween(a, b) {
  return Math.floor((b - a) / (24 * 3600 * 1000))
}

export default function RatingBanner({ hero }) {
  if (!hero) return null

  const rating   = hero.combat_rating ?? 0
  const played   = hero.combats_played ?? 0
  const won      = hero.combats_won ?? 0
  const grace    = hero.tier_grace_remaining ?? 0
  const lastAt   = hero.last_combat_at ? new Date(hero.last_combat_at).getTime() : null
  const now      = Date.now()

  const tier     = tierForRating(rating)
  const toNext   = pointsToNextTier(rating)

  // Tier siguiente (para mostrar el nombre)
  const idx      = TIERS.findIndex(t => rating >= t.min)
  const nextTier = idx > 0 ? TIERS[idx - 1] : null

  // Progreso dentro del tier actual → hacia el siguiente
  let progressPct = 100
  if (nextTier) {
    const span = nextTier.min - tier.min
    progressPct = span > 0 ? Math.min(100, ((rating - tier.min) / span) * 100) : 0
  }

  // Winrate
  const winrate = played > 0 ? Math.round((won / played) * 100) : null

  // Estimación de victorias "acordes" para siguiente tier (+15/combate)
  const winsEstimate = toNext != null ? Math.max(1, Math.ceil(toNext / 15)) : null

  // Decay
  const daysInactive = lastAt ? daysBetween(lastAt, now) : null
  const decayStarted = daysInactive != null && daysInactive > 3 && rating > 0
  const decayIn      = daysInactive != null && daysInactive <= 3 && rating > 0 ? 3 - daysInactive : null

  return (
    <div
      className="relative rounded-xl border shadow-[var(--shadow-sm)] overflow-hidden"
      style={{
        borderColor: `color-mix(in srgb, ${tier.color} 40%, var(--color-border))`,
        background:  `linear-gradient(135deg, color-mix(in srgb, ${tier.color} 8%, var(--color-surface)), var(--color-surface))`,
      }}
    >
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: tier.color }} />

      <div className="flex flex-col gap-3 px-4 py-3.5 pl-5 sm:flex-row sm:items-center sm:gap-5">
        {/* Bloque principal: tier + puntos */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0"
            style={{
              color: tier.color,
              background:  `color-mix(in srgb, ${tier.color} 14%, var(--color-surface))`,
              borderColor: `color-mix(in srgb, ${tier.color} 40%, var(--color-border))`,
            }}
          >
            <Shield size={22} strokeWidth={2.2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">Rating de combate</span>
            <span className="text-[18px] font-extrabold leading-tight truncate" style={{ color: tier.color }}>
              {tier.label}
            </span>
            <span className="text-[11px] font-semibold text-text-2 tabular-nums">
              {rating} pts
            </span>
          </div>
        </div>

        {/* Bloque progreso */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
            {nextTier ? (
              <>
                <span className="text-text-3">
                  Siguiente: <span className="text-text-2 font-bold">{nextTier.label}</span>
                </span>
                <span className="text-text-2 tabular-nums">
                  {toNext} pts {winsEstimate != null && <span className="text-text-3 font-medium">· ~{winsEstimate} victorias</span>}
                </span>
              </>
            ) : (
              <span className="text-text-3">Has alcanzado el rango máximo — <span className="text-text font-bold">Leyenda</span></span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-border)_60%,transparent)] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${progressPct}%`,
                background: tier.color,
              }}
            />
          </div>
        </div>

        {/* Stats + protección */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end">
          <span
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md border border-border bg-surface-2 text-text-2 tabular-nums"
            title={`${won}V / ${played - won}D`}
          >
            <Swords size={11} strokeWidth={2.5} />
            {played} combates{winrate != null && <span className="text-text-3 font-medium"> · {winrate}%</span>}
          </span>
          {grace > 0 && (
            <span
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md border"
              style={{
                color: '#16a34a',
                background:  'color-mix(in srgb, #16a34a 10%, var(--color-surface))',
                borderColor: 'color-mix(in srgb, #16a34a 35%, var(--color-border))',
              }}
              title="Protección anti-yo-yo: las derrotas no te degradarán este tier durante las próximas partidas."
            >
              <ShieldCheck size={11} strokeWidth={2.5} />
              Protección · {grace}
            </span>
          )}
          {decayStarted && (
            <span
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md border"
              style={{
                color: '#dc2626',
                background:  'color-mix(in srgb, #dc2626 10%, var(--color-surface))',
                borderColor: 'color-mix(in srgb, #dc2626 35%, var(--color-border))',
              }}
              title={`Llevas ${daysInactive} días sin combatir — pierdes 5 pts al día. Combate ya para detenerlo.`}
            >
              <TrendingDown size={11} strokeWidth={2.5} />
              Decay activo
            </span>
          )}
          {!decayStarted && decayIn != null && decayIn <= 1 && (
            <span
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md border border-[color-mix(in_srgb,#f59e0b_35%,var(--color-border))] bg-[color-mix(in_srgb,#f59e0b_10%,var(--color-surface))] text-[#b45309]"
              title={`Decay en ${decayIn === 0 ? 'menos de 1 día' : '1 día'} si no combates.`}
            >
              <TrendingDown size={11} strokeWidth={2.5} />
              Decay en {decayIn === 0 ? '<1d' : '1d'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
