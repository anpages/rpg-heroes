import { useHeroTactics } from '../hooks/useHeroTactics'

/**
 * Muestra las tácticas equipadas del héroe como chips compactos.
 * Usado en las vistas de combate (Preparación).
 */
export function TacticsStrip({ heroId, onNavigate }) {
  const { tactics } = useHeroTactics(heroId)
  const equipped = (tactics ?? []).filter(t => t.slot_index != null && t.tactic_catalog)

  if (!equipped.length) {
    return (
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[12px] text-text-3">Sin tácticas equipadas.</span>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="text-[12px] text-[#7c3aed] font-semibold"
          >
            Equipar →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {equipped.map(t => (
        <span
          key={t.id}
          className="flex items-center gap-1 px-2 py-1 bg-surface-2 border border-border rounded-lg text-[12px] font-semibold text-text-2"
        >
          <span>{t.tactic_catalog.icon}</span>
          <span>{t.tactic_catalog.name}</span>
        </span>
      ))}
    </div>
  )
}
