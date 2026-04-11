import { useAppStore } from '../store/appStore'
import { useTeamRanking } from '../hooks/useTeamRanking'
import { tierForRating } from '../lib/combatRating'
import { Trophy, Medal, Shield, Users } from 'lucide-react'

const CLASS_COLOR = {
  caudillo:  '#dc2626',
  arcanista: '#7c3aed',
  sombra:    '#0369a1',
  domador:   '#16a34a',
}

function PositionBadge({ position }) {
  if (position === 1) return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold px-2 py-0.5 rounded-md bg-warning-bg text-warning-text border border-warning-border">
      <Trophy size={14} strokeWidth={2} />1
    </span>
  )
  if (position === 2) return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold px-2 py-0.5 rounded-md bg-bg text-text-2 border border-border-2">
      <Medal size={14} strokeWidth={2} />2
    </span>
  )
  if (position === 3) return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,#f97316_10%,var(--surface))] text-[#c2410c] dark:text-[#fb923c] border border-[color-mix(in_srgb,#f97316_30%,var(--border))]">
      <Medal size={14} strokeWidth={2} />3
    </span>
  )
  return <span className="text-[14px] font-semibold text-text-3 w-7 text-center">{position}</span>
}

function TierBadge({ rating }) {
  const t = tierForRating(rating)
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.04em] uppercase px-2 py-0.5 rounded-md border whitespace-nowrap"
      style={{
        color: t.color,
        background:  `color-mix(in srgb, ${t.color} 10%, var(--surface))`,
        borderColor: `color-mix(in srgb, ${t.color} 32%, var(--border))`,
      }}
      title={`${rating ?? 0} pts`}
    >
      <Shield size={11} strokeWidth={2.5} />
      {t.label}
    </span>
  )
}

export default function TeamCombatRanking() {
  const userId = useAppStore(s => s.userId)
  const { ranking, loading } = useTeamRanking()

  if (loading) return <p className="text-text-3 text-[14px] text-center py-10">Cargando clasificación...</p>

  if (!ranking.length) {
    return (
      <div className="text-center py-12">
        <Users size={32} className="mx-auto text-text-3 opacity-60 mb-3" strokeWidth={1.6} />
        <p className="text-text-2 font-semibold">Sin escuadrones registrados</p>
        <p className="text-text-3 text-[13px] mt-1">Los jugadores con al menos 3 héroes aparecerán aquí.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="section-header">
        <h2 className="section-title">Clasificación 3v3</h2>
        <p className="section-subtitle">Ordena por el rating medio del trío con mayor rating de cada jugador.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[52px_1fr_auto_120px] gap-2 px-3.5 py-2.5 sm:px-5 bg-surface-2 border-b border-border text-[11px] font-bold tracking-[0.08em] uppercase text-text-3">
          <span>#</span>
          <span>Jugador</span>
          <span className="hidden sm:flex">Trío</span>
          <span className="flex justify-end">Rating medio</span>
        </div>

        {ranking.map((entry, i) => {
          const position = i + 1
          const isMe = entry.playerId === userId
          return (
            <div
              key={entry.playerId}
              className={`grid grid-cols-[40px_1fr_auto] sm:grid-cols-[52px_1fr_auto_120px] items-center gap-2 px-3.5 py-3 sm:px-5 sm:py-3.5 border-b border-border last:border-b-0 ${isMe ? 'bg-[var(--blue-50)]' : 'hover:bg-surface-2'}`}
            >
              <span className="flex items-center">
                <PositionBadge position={position} />
              </span>
              <span className="flex items-center gap-2 text-[14px] font-semibold text-text min-w-0">
                <span className="truncate">{entry.username ?? 'Jugador'}</span>
                {isMe && (
                  <span className="text-[10px] font-bold text-[var(--blue-600)] bg-[var(--blue-100)] rounded-[5px] px-1.5 py-px flex-shrink-0">
                    Tú
                  </span>
                )}
              </span>
              <span className="hidden sm:flex items-center gap-1">
                {entry.heroes.map((h, idx) => (
                  <span
                    key={idx}
                    className="w-5 h-5 rounded-md text-[9px] font-extrabold flex items-center justify-center uppercase"
                    style={{
                      color: CLASS_COLOR[h.class] ?? '#6b7280',
                      background: `color-mix(in srgb, ${CLASS_COLOR[h.class] ?? '#6b7280'} 14%, var(--surface-2))`,
                      border: `1px solid color-mix(in srgb, ${CLASS_COLOR[h.class] ?? '#6b7280'} 30%, var(--border))`,
                    }}
                    title={`${h.name} · ${h.combat_rating ?? 0}`}
                  >
                    {h.class?.[0]}
                  </span>
                ))}
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <TierBadge rating={entry.avg} />
                <span className="text-[10px] font-semibold text-text-3 tabular-nums">
                  {entry.avg} pts
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
