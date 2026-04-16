import { useRanking } from '../hooks/useRanking'
import { useAppStore } from '../store/appStore'
import { CLASS_COLORS, CLASS_LABELS } from '../lib/gameConstants'
import { Trophy, Medal, TowerControl, Swords } from 'lucide-react'

function PositionBadge({ position }) {
  if (position === 1) return (
    <span className="inline-flex items-center justify-center gap-1 text-[12px] font-black w-7 h-7 rounded-lg bg-[color-mix(in_srgb,#d97706_15%,var(--surface-2))] text-[#d97706] border border-[color-mix(in_srgb,#d97706_30%,var(--border))]">
      <Trophy size={13} strokeWidth={2.5} />
    </span>
  )
  if (position === 2) return (
    <span className="inline-flex items-center justify-center gap-1 text-[12px] font-black w-7 h-7 rounded-lg bg-surface-2 text-text-2 border border-border">
      <Medal size={13} strokeWidth={2.5} />
    </span>
  )
  if (position === 3) return (
    <span className="inline-flex items-center justify-center gap-1 text-[12px] font-black w-7 h-7 rounded-lg bg-[color-mix(in_srgb,#f97316_12%,var(--surface-2))] text-[#c2410c] border border-[color-mix(in_srgb,#f97316_25%,var(--border))]">
      <Medal size={13} strokeWidth={2.5} />
    </span>
  )
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 text-[13px] font-bold text-text-3">{position}</span>
  )
}

export default function Ranking() {
  const userId  = useAppStore(s => s.userId)
  const { ranking, loading } = useRanking()

  if (loading) return <div className="text-text-3 text-[15px] p-10 text-center">Cargando clasificación...</div>

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Clasificación</h2>
        <p className="section-subtitle">Los héroes más poderosos del reino, ordenados por nivel.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">

        {/* Cabecera */}
        <div className="grid grid-cols-[40px_1fr_56px_56px] px-3.5 py-2 bg-surface-2 border-b border-border text-[10px] font-bold tracking-[0.08em] uppercase text-text-3">
          <span>#</span>
          <span>Héroe</span>
          <span className="text-center">Torre</span>
          <span className="text-right">Nivel</span>
        </div>

        {ranking?.length === 0 && (
          <div className="p-10 text-center text-text-3 text-[14px]">Aún no hay héroes registrados.</div>
        )}

        {ranking?.map((entry, i) => {
          const position  = i + 1
          const isMe      = entry.player_id === userId
          const color     = CLASS_COLORS[entry.class] ?? '#6b7280'
          const classLabel = CLASS_LABELS[entry.class] ?? entry.class
          const maxFloor  = entry.tower_progress?.max_floor ?? 0
          const played    = entry.combats_played ?? 0
          const won       = entry.combats_won ?? 0
          const winRate   = played > 0 ? Math.round((won / played) * 100) : null

          return (
            <div
              key={entry.id}
              className={`grid grid-cols-[40px_1fr_56px_56px] items-center px-3.5 py-3 border-b border-border last:border-b-0 transition-[background] duration-150
                ${isMe ? 'bg-[color-mix(in_srgb,var(--btn-primary)_6%,var(--surface))]' : 'hover:bg-surface-2'}`}
            >
              {/* Posición */}
              <span className="flex items-center">
                <PositionBadge position={position} />
              </span>

              {/* Nombre + clase + winrate */}
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[14px] font-bold text-text truncate">{entry.name}</span>
                  {isMe && (
                    <span className="text-[10px] font-bold shrink-0"
                      style={{ color: 'var(--btn-primary)' }}>
                      Tú
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold tracking-[0.05em] uppercase px-1.5 py-px rounded border"
                    style={{
                      color,
                      background: `color-mix(in srgb, ${color} 12%, var(--surface))`,
                      borderColor: `color-mix(in srgb, ${color} 25%, var(--border))`,
                    }}
                  >
                    {classLabel}
                  </span>
                  {winRate !== null && (
                    <span className="flex items-center gap-1 text-[10px] text-text-3">
                      <Swords size={10} strokeWidth={2} />
                      {winRate}%
                    </span>
                  )}
                </span>
              </span>

              {/* Piso torre */}
              <span className="flex items-center justify-center gap-1 text-[13px] font-bold text-text-2">
                {maxFloor > 0
                  ? <><TowerControl size={12} strokeWidth={2} className="text-text-3" />{maxFloor}</>
                  : <span className="text-text-3 text-[11px]">—</span>
                }
              </span>

              {/* Nivel */}
              <span className="text-right text-[14px] font-black text-text">
                {entry.level}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
