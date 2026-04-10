import { useEffect, useReducer } from 'react'
import { Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { LIBRARY_BASE_LEVEL_REQUIRED } from '../../lib/gameConstants.js'
import { cardVariants, BUILDING_META } from './constants.js'
import { baseLevelFromMap } from './helpers.js'
import { BuildingCard } from './BuildingCard.jsx'
import { ResearchTree } from './Research.jsx'

export default function BibliotecaZone({ byType, research, resources, onResearchStart, onResearchCollect, startPending, collectPending, anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending }) {
  const library   = byType['library']
  const baseLevel = baseLevelFromMap(byType)
  const labLevel  = byType['laboratory']?.level ?? 0
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    if (!research.active) return
    const id = setInterval(forceUpdate, 1000)
    return () => clearInterval(id)
  }, [research.active])

  // Biblioteca bloqueada: lab < Nv2 o base < 3
  if (!library || library.unlocked === false) {
    const meta    = BUILDING_META['library']
    const Icon    = meta.icon
    const reason  = labLevel < 2
      ? 'Requiere Laboratorio Nv.2'
      : `Requiere base nivel ${LIBRARY_BASE_LEVEL_REQUIRED}`

    return (
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <div
          className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] opacity-60"
          style={{ '--accent': meta.color }}
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
              <Icon size={18} strokeWidth={1.8} color={meta.color} />
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-text truncate">{meta.name}</h3>
              <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 py-3 border-y border-border bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
            <p className="text-[13px] text-text-3 text-center">{meta.description}</p>
          </div>
          <div className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3">
              <Lock size={11} strokeWidth={2.5} />
              {reason}
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  // Biblioteca desbloqueada pero base < 3 → no se puede construir aún
  if (library.level === 0 && !library.upgrade_ends_at && baseLevel < LIBRARY_BASE_LEVEL_REQUIRED) {
    const meta = BUILDING_META['library']
    const Icon = meta.icon
    return (
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <div
          className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] opacity-60"
          style={{ '--accent': meta.color }}
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
              <Icon size={18} strokeWidth={1.8} color={meta.color} />
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-text truncate">{meta.name}</h3>
              <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 py-3 border-y border-border bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
            <p className="text-[13px] text-text-3 text-center">{meta.description}</p>
          </div>
          <div className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3">
              <Lock size={11} strokeWidth={2.5} />
              Requiere base nivel {LIBRARY_BASE_LEVEL_REQUIRED} para construir.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      {library && (
        <BuildingCard
          building={library}
          resources={resources}
          anyUpgrading={anyUpgrading}
          onUpgradeStart={onUpgradeStart}
          onUpgradeCollect={onUpgradeCollect}
          onOptimisticDeduct={onOptimisticDeduct}
          onUpgradePending={onUpgradePending}
        />
      )}

      {library.level >= 1 && (
        <ResearchTree
          research={research}
          resources={resources}
          libraryLevel={library.level}
          libraryUpgrading={!!(library.upgrade_ends_at && new Date(library.upgrade_ends_at) > new Date())}
          onStart={onResearchStart}
          onCollect={onResearchCollect}
          startPending={startPending}
          collectPending={collectPending}
        />
      )}
    </motion.div>
  )
}
