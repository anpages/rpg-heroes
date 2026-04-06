import { useState } from 'react'
import { useHeroId } from '../hooks/useHeroId'
import { useCombatHistory } from '../hooks/useCombatHistory'
import { CombatReplay } from '../components/CombatReplay'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'Ahora'
  if (m < 60) return `Hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `Hace ${h}h`
  return `Hace ${Math.floor(h / 24)}d`
}

export default function CombatHistorial() {
  const heroId = useHeroId()
  const { data: combats, isLoading } = useCombatHistory(heroId)
  const [replay, setReplay] = useState(null)

  if (isLoading) return (
    <p className="text-text-3 text-[14px] text-center py-10">Cargando historial...</p>
  )

  if (!combats?.length) return (
    <div className="text-center py-12">
      <p className="text-[32px] mb-3">⚔️</p>
      <p className="text-text-2 font-semibold">Sin combates registrados</p>
      <p className="text-text-3 text-[13px] mt-1">Los combates de la Torre aparecerán aquí</p>
    </div>
  )

  return (
    <>
      <div className="flex flex-col gap-2">
        {combats.map(c => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl"
          >
            {/* Resultado */}
            <span className="text-[22px] leading-none flex-shrink-0">
              {c.won ? '🏆' : '💀'}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-bold ${c.won ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
                  {c.won ? 'Victoria' : 'Derrota'}
                </span>
                <span className="text-[12px] text-text-3">·</span>
                <span className="text-[12px] font-semibold text-text-2">Piso {c.floor}</span>
                <span className="text-[12px] text-text-3">·</span>
                <span className="text-[12px] text-text-3">{c.rounds} rondas</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-text-3">{c.hero_name} vs {c.enemy_name}</span>
                <span className="text-[11px] text-text-3 ml-auto">{timeAgo(c.created_at)}</span>
              </div>
            </div>

            {/* Botón replay — solo si hay log guardado */}
            {c.log?.length > 0 && (
              <button
                className="btn btn--ghost btn--sm flex-shrink-0"
                onClick={() => setReplay(c)}
              >
                Ver
              </button>
            )}
          </div>
        ))}
      </div>

      {replay && (
        <CombatReplay
          heroName={replay.hero_name ?? 'Héroe'}
          enemyName={replay.enemy_name ?? 'Rival'}
          heroMaxHp={replay.hero_max_hp ?? 100}
          enemyMaxHp={replay.enemy_max_hp ?? 100}
          log={replay.log ?? []}
          won={replay.won}
          rewards={null}
          knockedOut={false}
          onClose={() => setReplay(null)}
        />
      )}
    </>
  )
}
