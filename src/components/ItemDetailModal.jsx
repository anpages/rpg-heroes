import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Sword, Shield, Crown, Shirt, Hand, Move, Gem, Weight, Sparkles, ArrowLeft, Plus } from 'lucide-react'

const SLOT_META = {
  helmet:      { label: 'Casco',           icon: Crown  },
  chest:       { label: 'Torso',           icon: Shirt  },
  arms:        { label: 'Brazos',          icon: Hand   },
  legs:        { label: 'Piernas',         icon: Move   },
  main_hand:   { label: 'Arma Principal',  icon: Sword  },
  off_hand:    { label: 'Mano Secundaria', icon: Shield },
  accessory:   { label: 'Complemento',     icon: Gem    },
  accessory_2: { label: 'Complemento 2',   icon: Gem    },
}

const RARITY_META = {
  common:    { label: 'Común',       color: '#6b7280' },
  uncommon:  { label: 'Poco común',  color: '#16a34a' },
  rare:      { label: 'Raro',        color: '#2563eb' },
  epic:      { label: 'Épico',       color: '#7c3aed' },
  legendary: { label: 'Legendario',  color: '#d97706' },
}

import { CLASS_COLORS, CLASS_LABELS } from '../lib/gameConstants'

const RUNE_BONUS_LABELS = { attack: 'Ataque', defense: 'Defensa', intelligence: 'Inteligencia', agility: 'Agilidad', max_hp: 'HP', strength: 'Fuerza' }
const RUNE_BONUS_COLORS = { attack: '#d97706', defense: '#6b7280', intelligence: '#7c3aed', agility: '#2563eb', max_hp: '#dc2626', strength: '#dc2626' }

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

/* ─── runeProps: { hasLab, maxRuneSlots, runeInventory, runePending, isExploring, onInsertRune }
   Si no se pasan, la sección de runas es solo lectura (Ficha).               ── */

export function ItemDetailModal({ item, onClose, runeProps, heroClass }) {
  const [pickingSlot, setPickingSlot] = useState(null)

  const catalog  = item.item_catalog
  const rarity   = RARITY_META[catalog.rarity]
  const slot     = SLOT_META[catalog.slot]
  const SlotIcon = slot?.icon ?? Sword
  const durPct   = Math.round((item.current_durability / catalog.max_durability) * 100)
  const durColor = durPct > 60 ? '#16a34a' : durPct > 30 ? '#d97706' : '#dc2626'

  const statLines = [
    { label: 'Ataque',       val: catalog.attack_bonus       },
    { label: 'Defensa',      val: catalog.defense_bonus      },
    { label: 'HP',           val: catalog.hp_bonus           },
    { label: 'Fuerza',       val: catalog.strength_bonus     },
    { label: 'Agilidad',     val: catalog.agility_bonus      },
    { label: 'Inteligencia', val: catalog.intelligence_bonus },
  ].filter(s => s.val > 0)

  const runesOnItem       = item.item_runes ?? []
  const { hasLab = false, maxRuneSlots = 0, runeInventory = [], runePending = false, isExploring = false, onInsertRune } = runeProps ?? {}
  const canManageRunes    = !!onInsertRune
  const showRuneSection   = canManageRunes ? (hasLab && maxRuneSlots > 0) : runesOnItem.length > 0
  const hasRunesAvailable = runeInventory.some(ir => ir.quantity > 0)
  const available         = runeInventory.filter(ir => ir.quantity > 0)

  const handleClose = () => {
    setPickingSlot(null)
    onClose()
  }

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
      onClick={handleClose}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden"
        style={{ width: 'min(400px, 92vw)', maxHeight: '90dvh' }}
        variants={sheetVariants()} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          {pickingSlot !== null && (
            <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3 transition-colors flex-shrink-0"
              onClick={() => setPickingSlot(null)}>
              <ArrowLeft size={14} strokeWidth={2} />
            </button>
          )}
          <SlotIcon size={15} strokeWidth={1.8} className="text-text-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-text truncate">
              {pickingSlot !== null ? `Insertar en Slot ${pickingSlot + 1}` : catalog.name}
            </p>
            {pickingSlot !== null && (
              <p className="text-[11px] text-text-3 truncate">{catalog.name}</p>
            )}
          </div>
          <button className="btn btn--ghost btn--icon flex-shrink-0" onClick={handleClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* ── Vista principal: info del ítem ── */}
          {pickingSlot === null && (
            <div className="flex flex-col gap-4 px-5 py-4">

              {/* Badges */}
              {(() => {
                const classColor = CLASS_COLORS[catalog.required_class] ?? '#6b7280'
                const isOwn = catalog.required_class && heroClass === catalog.required_class
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    {isOwn && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded border"
                        style={{ color: classColor, borderColor: `color-mix(in srgb,${classColor} 30%,var(--border))`, background: `color-mix(in srgb,${classColor} 8%,var(--surface))` }}>
                        {CLASS_LABELS[catalog.required_class] ?? catalog.required_class}
                      </span>
                    )}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded border"
                      style={{ color: rarity.color, borderColor: `color-mix(in srgb,${rarity.color} 30%,var(--border))`, background: `color-mix(in srgb,${rarity.color} 8%,var(--surface))` }}>
                      {rarity.label}
                    </span>
                    <span className="text-[11px] font-bold text-text-3 bg-surface-2 border border-border px-2 py-0.5 rounded">T{catalog.tier}</span>
                    <span className="text-[11px] text-text-3">{slot?.label}</span>
                    {catalog.is_two_handed && <span className="text-[11px] font-semibold text-[#d97706]">2 manos</span>}
                    {catalog.required_class && !isOwn && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded border"
                        style={{ color: classColor, borderColor: `color-mix(in srgb,${classColor} 30%,var(--border))`, background: `color-mix(in srgb,${classColor} 8%,var(--surface))` }}>
                        {CLASS_LABELS[catalog.required_class] ?? catalog.required_class}
                      </span>
                    )}
                  </div>
                )
              })()}

              {/* Description */}
              {catalog.description && (
                <p className="text-[13px] text-text-2 italic leading-relaxed">{catalog.description}</p>
              )}

              {/* Stats del catálogo */}
              {(statLines.length > 0 || (catalog.weight ?? 0) > 0) && (
                <div className="flex flex-wrap gap-2">
                  {statLines.map(s => (
                    <span key={s.label} className="text-[11px] font-bold text-[#16a34a] bg-success-bg border border-success-border rounded-md px-2 py-1">
                      +{s.val} {s.label}
                    </span>
                  ))}
                  {(catalog.weight ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-text-3 bg-surface-2 border border-border rounded-md px-2 py-1">
                      <Weight size={10} strokeWidth={2} />{catalog.weight} peso
                    </span>
                  )}
                </div>
              )}

              {/* Durabilidad */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[12px] text-text-3">
                  <span>Durabilidad</span>
                  <span style={{ color: durColor }}>{item.current_durability} / {catalog.max_durability} ({durPct}%)</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${durPct}%`, background: durColor }} />
                </div>
              </div>

              {/* ── Sección de runas ── */}
              {showRuneSection && (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} strokeWidth={2} className="text-[#7c3aed]" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-3">Runas</p>
                    {!canManageRunes && <span className="text-[10px] text-text-3 italic">(ve a Equipo para gestionar)</span>}
                  </div>

                  {/* Si tenemos gestión completa: mostrar todos los slots */}
                  {canManageRunes && Array.from({ length: maxRuneSlots }).map((_, idx) => {
                    const inserted = runesOnItem.find(r => r.slot_index === idx)
                    if (inserted) {
                      const rc    = inserted.rune_catalog
                      const main  = rc?.bonuses?.[0]
                      const color = RUNE_BONUS_COLORS[main?.stat] ?? '#7c3aed'
                      return (
                        <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-xl border"
                          style={{ borderColor: `color-mix(in srgb,${color} 30%,var(--border))`, background: `color-mix(in srgb,${color} 5%,var(--surface-2))` }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-text-3">Slot {idx + 1}</p>
                          <div className="flex items-center gap-2">
                            <Sparkles size={12} strokeWidth={2} style={{ color }} />
                            <span className="text-[13px] font-bold" style={{ color }}>{rc?.name ?? 'Runa'}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {(rc?.bonuses ?? []).map(({ stat, value }, i) => (
                              <span key={i} className="text-[11px] font-semibold" style={{ color: RUNE_BONUS_COLORS[stat] ?? color }}>
                                +{value} {RUNE_BONUS_LABELS[stat] ?? stat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-dashed border-border">
                        <p className="text-[12px] text-text-3">Slot {idx + 1} — vacío</p>
                        {hasRunesAvailable ? (
                          <button
                            className="btn btn--primary btn--sm flex-shrink-0"
                            onClick={() => setPickingSlot(idx)}
                            disabled={runePending || isExploring}
                          >
                            <Plus size={11} strokeWidth={2} /> Insertar
                          </button>
                        ) : (
                          <span className="text-[11px] text-text-3 italic">Sin runas</span>
                        )}
                      </div>
                    )
                  })}

                  {/* Si solo lectura: mostrar las runas que tiene */}
                  {!canManageRunes && runesOnItem.map((ir, idx) => {
                    const rc    = ir.rune_catalog
                    const main  = rc?.bonuses?.[0]
                    const color = RUNE_BONUS_COLORS[main?.stat] ?? '#7c3aed'
                    return (
                      <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-xl border"
                        style={{ borderColor: `color-mix(in srgb,${color} 30%,var(--border))`, background: `color-mix(in srgb,${color} 5%,var(--surface-2))` }}>
                        <div className="flex items-center gap-2">
                          <Sparkles size={12} strokeWidth={2} style={{ color }} />
                          <span className="text-[13px] font-bold" style={{ color }}>{rc?.name ?? 'Runa'}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {(rc?.bonuses ?? []).map(({ stat, value }, i) => (
                            <span key={i} className="text-[11px] font-semibold" style={{ color: RUNE_BONUS_COLORS[stat] ?? color }}>
                              +{value} {RUNE_BONUS_LABELS[stat] ?? stat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {canManageRunes && (
                    <p className="text-[10px] text-text-3 italic">Las runas son permanentes una vez incrustadas.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Vista selector de runa ── */}
          {pickingSlot !== null && (
            <div className="flex flex-col gap-2 px-5 py-4">
              {available.map(ir => {
                const rc       = ir.rune_catalog
                const main     = rc?.bonuses?.[0]
                const color    = RUNE_BONUS_COLORS[main?.stat] ?? '#475569'
                const bonusTxt = (rc?.bonuses ?? []).map(({ stat, value }) => `+${value} ${RUNE_BONUS_LABELS[stat] ?? stat}`).join(' · ')
                return (
                  <button key={ir.rune_id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-[color:var(--blue-400)] bg-surface hover:bg-surface-2 transition-all text-left"
                    onClick={() => { onInsertRune({ item, slotIndex: pickingSlot, runeId: ir.rune_id }); handleClose() }}
                    disabled={runePending || isExploring}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
                      style={{ background: `color-mix(in srgb,${color} 12%,var(--surface-2))`, color }}>
                      {ir.quantity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-text truncate">{rc?.name}</p>
                      <p className="text-[11px] text-text-3">{bonusTxt}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
