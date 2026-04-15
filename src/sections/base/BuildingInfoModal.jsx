import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Axe, Pickaxe, Sparkles, Clock, ChevronRight, ArrowUp, Wrench } from 'lucide-react'
import { buildingUpgradeCost, buildingUpgradeDurationMs, BUILDING_MAX_LEVEL } from '../../lib/gameConstants.js'
import { BUILDING_META } from './constants.js'
import { fmt, fmtTime } from './helpers.js'

const EASE_OUT = [0.22, 1, 0.36, 1]
const EASE_IN  = [0.55, 0, 0.75, 0.06]

const sheetVariants = {
  initial: { y: '100%' },
  animate: { y: 0,      transition: { type: 'tween', ease: EASE_OUT, duration: 0.26 } },
  exit:    { y: '100%', transition: { type: 'tween', ease: EASE_IN,  duration: 0.18 } },
}

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

export default function BuildingInfoModal({
  building, resources, anyUpgrading, onUpgradeStart, onClose,
}) {
  const meta = BUILDING_META[building.type]
  if (!meta) return null

  const { level } = building
  const isMaxLevel = level >= BUILDING_MAX_LEVEL
  const isBuild = level === 0
  const Icon = meta.icon
  const cost = buildingUpgradeCost(building.type, level)
  const durationSecs = Math.round(buildingUpgradeDurationMs(level, building.type) / 1000)

  const canAfford = resources
    && (cost.wood === undefined || resources.wood >= cost.wood)
    && (cost.iron === undefined || resources.iron >= cost.iron)
    && (cost.mana === undefined || resources.mana >= cost.mana)
  const blockedByOther = anyUpgrading

  function handleUpgrade() {
    onUpgradeStart()
    onClose()
  }

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center sm:p-5"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden w-full sm:w-auto"
        style={{ maxWidth: 'min(420px, 100vw)', maxHeight: '90dvh' }}
        variants={sheetVariants} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `color-mix(in srgb, ${meta.color} 14%, var(--surface-2))`,
              border: `1px solid color-mix(in srgb, ${meta.color} 25%, var(--border))`,
            }}
          >
            <Icon size={22} strokeWidth={1.8} color={meta.color} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold text-text truncate">{meta.name}</p>
            {level > 0 && (
              <span
                className="inline-block text-[12px] font-bold rounded px-2 py-0.5 mt-1 leading-none"
                style={{
                  color: meta.color,
                  background: `color-mix(in srgb, ${meta.color} 10%, var(--surface-2))`,
                  border: `1px solid color-mix(in srgb, ${meta.color} 25%, var(--border))`,
                }}
              >
                Nivel {level}
              </span>
            )}
            {level === 0 && (
              <span className="inline-block text-[12px] font-bold text-text-3 bg-surface-2 border border-border rounded px-2 py-0.5 mt-1 leading-none">
                Sin construir
              </span>
            )}
          </div>
          <button className="btn btn--ghost btn--icon flex-shrink-0" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-5 px-5 py-5">

            {/* Description */}
            <p className="text-[14px] text-text-2 leading-relaxed">{meta.description}</p>

            {/* Current effect */}
            {level > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold text-text-3 uppercase tracking-wide">Efecto actual</span>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-2 border border-border">
                  <Wrench size={14} strokeWidth={2} className="text-text-3 flex-shrink-0" />
                  <span className="text-[14px] font-semibold text-text">{meta.effect(level)}</span>
                </div>
              </div>
            )}

            {/* Max level */}
            {isMaxLevel && (
              <div className="flex items-center justify-center py-3 rounded-xl bg-surface-2 border border-border">
                <span className="text-[13px] font-bold text-text-3 uppercase tracking-wide">Nivel maximo alcanzado</span>
              </div>
            )}

            {/* Upgrade info */}
            {!isMaxLevel && (
              <div className="flex flex-col gap-3">
                <span className="text-[12px] font-bold text-text-3 uppercase tracking-wide">
                  {isBuild ? 'Construir' : `Mejorar a Nivel ${level + 1}`}
                </span>

                {/* Next effect */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                  style={{
                    background: `color-mix(in srgb, ${meta.color} 6%, var(--surface))`,
                    borderColor: `color-mix(in srgb, ${meta.color} 20%, var(--border))`,
                  }}
                >
                  <ArrowUp size={14} strokeWidth={2.5} style={{ color: meta.color }} className="flex-shrink-0" />
                  <span className="text-[14px] font-semibold" style={{ color: meta.color }}>
                    {isBuild ? meta.nextEffect(0) : meta.nextEffect(level)}
                  </span>
                </div>

                {/* Cost */}
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-bold text-text-3 uppercase tracking-wide">Coste</span>
                  <div className="flex items-center gap-3 flex-wrap">
                    {cost.wood !== undefined && (
                      <span className={`flex items-center gap-1.5 text-[15px] font-bold ${resources?.wood >= cost.wood ? 'text-success-text' : 'text-error-text'}`}>
                        <Axe size={15} strokeWidth={2} />{fmt(cost.wood)}
                      </span>
                    )}
                    {cost.iron !== undefined && (
                      <span className={`flex items-center gap-1.5 text-[15px] font-bold ${resources?.iron >= cost.iron ? 'text-success-text' : 'text-error-text'}`}>
                        <Pickaxe size={15} strokeWidth={2} />{fmt(cost.iron)}
                      </span>
                    )}
                    {cost.mana !== undefined && (
                      <span className={`flex items-center gap-1.5 text-[15px] font-bold ${resources?.mana >= cost.mana ? 'text-success-text' : 'text-error-text'}`}>
                        <Sparkles size={15} strokeWidth={2} />{fmt(cost.mana)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-2 text-[14px] text-text-3">
                  <Clock size={14} strokeWidth={2} />
                  <span className="font-semibold">{fmtTime(durationSecs)}</span>
                </div>

                {/* Blocked message */}
                {blockedByOther && (
                  <p className="text-[13px] text-warning-text font-medium">
                    Ya hay un edificio en construccion. Espera a que termine.
                  </p>
                )}

                {/* Upgrade button */}
                <motion.button
                  className="w-full py-3 rounded-xl font-bold text-[15px] border-0 text-white mt-1 disabled:opacity-40"
                  style={{
                    background: canAfford && !blockedByOther
                      ? `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 75%, #000))`
                      : `color-mix(in srgb, ${meta.color} 25%, var(--surface-2))`,
                    color: canAfford && !blockedByOther ? '#fff' : 'var(--text-3)',
                  }}
                  onClick={handleUpgrade}
                  disabled={!canAfford || blockedByOther}
                  whileTap={canAfford && !blockedByOther ? { scale: 0.97 } : {}}
                >
                  {isBuild ? 'Construir' : 'Mejorar'} <ChevronRight size={16} strokeWidth={2.5} className="inline ml-1 -mt-0.5" />
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
