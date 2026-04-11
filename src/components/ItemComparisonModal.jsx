import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Scale, Star, Check } from 'lucide-react'

const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768

const EASE_OUT = [0.25, 0.46, 0.45, 0.94]
const EASE_IN  = [0.55, 0,    0.75, 0.06]

function sheetVariants() {
  if (isMobile()) {
    return {
      initial: { y: '100vh' },
      animate: { y: 0,       transition: { type: 'tween', ease: EASE_OUT, duration: 0.38 } },
      exit:    { y: '100vh', transition: { type: 'tween', ease: EASE_IN,  duration: 0.26 } },
    }
  }
  return {
    initial: { opacity: 0, scale: 0.97, y: 10 },
    animate: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', stiffness: 260, damping: 26 } },
    exit:    { opacity: 0, scale: 0.98, y: 4,  transition: { type: 'tween', ease: EASE_IN, duration: 0.18 } },
  }
}

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

const overlayTransition = { duration: 0.25, ease: 'easeOut' }

const RARITY_META = {
  common:    { label: 'Común',      color: '#6b7280' },
  uncommon:  { label: 'Poco Común', color: '#16a34a' },
  rare:      { label: 'Raro',       color: '#2563eb' },
  epic:      { label: 'Épico',      color: '#7c3aed' },
  legendary: { label: 'Legendario', color: '#d97706' },
}

/**
 * Modal de comparación de stats entre un ítem candidato y el equipado.
 *
 * Props:
 *   item.name, item.rarity, item.tier          — datos del candidato para el header
 *   isNewSlot                                   — true si no hay nada en el slot
 *   equipped                                    — inventory_item equipado (o null)
 *   diffs[]                                     — pre-computado por el caller
 *   totalDiff                                   — suma de diffs (decide color del verdict)
 *   slotLabel                                   — "Casco", "Pecho", etc.
 *   candidateLabel                              — etiqueta de la columna del candidato
 *                                                 ("Tienda", "Mochila", "Nuevo"…)
 */
export default function ItemComparisonModal({
  item,
  isNewSlot,
  equipped,
  diffs,
  totalDiff,
  slotLabel,
  candidateLabel = 'Nuevo',
  onClose,
  onEquip,               // opcional: si se pasa, se muestra el botón de equipar
  equipLabel = 'Equipar',
  equipDisabled = false,
  equipDisabledReason,
}) {
  const rarity = RARITY_META[item.rarity] ?? RARITY_META.common

  let verdictColor = '#6b7280'
  let verdictLabel = 'Stats similares'
  let verdictDetail = null

  if (isNewSlot) {
    verdictColor = '#16a34a'
    verdictLabel = 'Hueco libre'
    verdictDetail = `No tienes ningún ítem de ${slotLabel.toLowerCase()}.`
  } else if (!equipped) {
    verdictColor = '#6b7280'
    verdictLabel = 'Sin ítem equipado'
    verdictDetail = `Tienes ${slotLabel.toLowerCase()} en la mochila, pero ninguno equipado.`
  } else {
    verdictColor =
      totalDiff > 0 ? '#16a34a' :
      totalDiff < 0 ? '#dc2626' :
      '#6b7280'
    verdictLabel =
      totalDiff > 0 ? 'Mejora el equipado' :
      totalDiff < 0 ? 'Peor que el equipado' :
      'Stats similares'
  }

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
      onClick={onClose}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 p-5"
        style={{ width: 'min(420px, 94vw)' }}
        variants={sheetVariants()} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wide text-text-3">Comparar con equipado</span>
            <span className="text-[15px] font-bold truncate" style={{ color: rarity.color }} title={item.name}>
              {item.name}
            </span>
            <span className="text-[11px] text-text-3">
              {slotLabel} · {rarity.label} · T{item.tier}
            </span>
          </div>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3 hover:text-text hover:bg-surface-2 transition-colors flex-shrink-0"
            onClick={onClose}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Verdict banner */}
        <div
          className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
          style={{
            borderColor: `color-mix(in srgb, ${verdictColor} 40%, var(--color-border))`,
            background:  `color-mix(in srgb, ${verdictColor} 8%, var(--color-surface))`,
          }}
        >
          {isNewSlot
            ? <Star size={14} strokeWidth={2.5} className="mt-[2px] flex-shrink-0" style={{ color: verdictColor }} />
            : <Scale size={14} strokeWidth={2.5} className="mt-[2px] flex-shrink-0" style={{ color: verdictColor }} />
          }
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={{ color: verdictColor }}>{verdictLabel}</div>
            {verdictDetail && <div className="text-[11px] text-text-3 mt-[2px]">{verdictDetail}</div>}
            {equipped && !isNewSlot && (
              <div className="text-[11px] text-text-3 mt-[2px] truncate" title={equipped.item_catalog?.name}>
                vs {equipped.item_catalog?.name} · T{equipped.item_catalog?.tier}
              </div>
            )}
          </div>
        </div>

        {/* Stat diffs table (only when comparing vs equipped) */}
        {equipped && diffs && diffs.length > 0 && (
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1.5 px-3 py-2.5 text-[11px]">
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-3">Stat</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-3 text-right">Equipado</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-3 text-right">{candidateLabel}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-3 text-right">Δ</div>
              {diffs.map(({ key, label, Icon, equipped: eq, candidate, diff }) => {
                const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : 'var(--color-text-3)'
                const sign = diff > 0 ? '+' : ''
                return (
                  <div key={key} className="contents">
                    <div className="flex items-center gap-1.5 text-text-2">
                      <Icon size={12} strokeWidth={2} className="text-text-3 flex-shrink-0" />
                      <span>{label}</span>
                    </div>
                    <div className="text-right tabular-nums text-text-2">{eq}</div>
                    <div className="text-right tabular-nums font-semibold text-text">{candidate}</div>
                    <div className="text-right tabular-nums font-bold" style={{ color: diffColor }}>
                      {diff === 0 ? '·' : `${sign}${diff}`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {onEquip && (
          <button
            type="button"
            className="btn btn--primary w-full flex items-center justify-center gap-1.5 disabled:opacity-50"
            onClick={() => { onEquip(); onClose() }}
            disabled={equipDisabled}
            title={equipDisabled ? equipDisabledReason : undefined}
          >
            <Check size={14} strokeWidth={2.5} />
            {equipLabel}
          </button>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
