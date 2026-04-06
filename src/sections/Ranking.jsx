import { useRanking } from '../hooks/useRanking'
import { useAppStore } from '../store/appStore'
import { Trophy, Medal } from 'lucide-react'

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

function Ranking() {
  const userId = useAppStore(s => s.userId)
  const { ranking, loading } = useRanking()

  if (loading) return <div className="text-text-3 text-[15px] p-10 text-center">Cargando clasificación...</div>

  const rowBase = 'grid grid-cols-[44px_1fr_80px] sm:grid-cols-[56px_1fr_130px_90px] items-center px-3.5 py-3 sm:px-5 sm:py-3.5 border-b border-border transition-[background] duration-150 last:border-b-0'

  return (
    <div className="ranking-section">
      <div className="section-header">
        <h2 className="section-title">Clasificación</h2>
        <p className="section-subtitle">Los héroes más poderosos del reino, ordenados por nivel.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
        {/* Header */}
        <div className="grid grid-cols-[44px_1fr_80px] sm:grid-cols-[56px_1fr_130px_90px] px-3.5 py-2.5 sm:px-5 bg-surface-2 border-b border-border text-[11px] font-bold tracking-[0.08em] uppercase text-text-3">
          <span>#</span>
          <span>Héroe</span>
          <span className="hidden sm:flex">Clase</span>
          <span className="flex sm:justify-end">Nivel</span>
        </div>

        {ranking?.length === 0 && (
          <div className="p-10 text-center text-text-3 text-[15px]">Aún no hay héroes registrados.</div>
        )}

        {ranking?.map((entry, i) => {
          const position = i + 1
          const isMe = entry.player_id === userId
          const cls = entry.classes

          return (
            <div
              key={entry.player_id}
              className={`${rowBase} ${isMe ? 'bg-[var(--blue-50)] hover:bg-[var(--blue-100)]' : 'hover:bg-surface-2'}`}
            >
              <span className="flex items-center">
                <PositionBadge position={position} />
              </span>
              <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
                {entry.name}
                {isMe && (
                  <span className="text-[11px] font-bold text-[var(--blue-600)] bg-[var(--blue-100)] rounded-[5px] px-1.5 py-px">
                    Tú
                  </span>
                )}
              </span>
              <span className="hidden sm:flex items-center">
                {cls && (
                  <span
                    className="text-[11px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-md border"
                    style={{
                      color: cls.color,
                      background: `color-mix(in srgb, ${cls.color} 12%, var(--surface))`,
                      borderColor: `color-mix(in srgb, ${cls.color} 28%, var(--border))`,
                    }}
                  >
                    {cls.name ?? entry.class}
                  </span>
                )}
              </span>
              <span className="flex items-center justify-end text-[14px] font-bold text-text">
                Nv. {entry.level}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Ranking
