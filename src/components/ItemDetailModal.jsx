import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Sword, Shield, Crown, Shirt, Hand, Move, Gem, Weight } from 'lucide-react'

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

// Keys = stat names guardadas en inventory_items.enchantments
const RUNE_META = {
  attack_bonus:       { label: 'Ataque',       color: '#d97706', base: 10 },
  defense_bonus:      { label: 'Defensa',      color: '#6b7280', base: 10 },
  hp_bonus:           { label: 'Vida',         color: '#dc2626', base: 80 },
  strength_bonus:     { label: 'Fuerza',       color: '#b91c1c', base: 8  },
  agility_bonus:      { label: 'Agilidad',     color: '#2563eb', base: 8  },
  intelligence_bonus: { label: 'Inteligencia', color: '#7c3aed', base: 8  },
}

const RARITY_META = {
  common:    { label: 'Común',       color: '#6b7280' },
  uncommon:  { label: 'Poco común',  color: '#16a34a' },
  rare:      { label: 'Raro',        color: '#2563eb' },
  epic:      { label: 'Épico',       color: '#7c3aed' },
  legendary: { label: 'Legendario',  color: '#d97706' },
}

import { CLASS_COLORS, CLASS_LABELS } from '../lib/gameConstants'

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

const overlayTransition = { duration: 0.15 }

export function ItemDetailModal({ item, onClose, heroClass }) {
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

  const handleClose = () => {
    onClose()
  }

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center sm:p-5"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
      onClick={handleClose}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden w-full"
        style={{ maxWidth: 'min(400px, 100vw)', maxHeight: '90dvh' }}
        variants={sheetVariants} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <SlotIcon size={15} strokeWidth={1.8} className="text-text-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-text truncate">{catalog.name}</p>
          </div>
          <button className="btn btn--ghost btn--icon flex-shrink-0" onClick={handleClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

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

              {/* Encantamientos */}
              {item.enchantments && Object.values(item.enchantments).some(v => v > 0) && (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] font-semibold text-text-3 uppercase tracking-wide">Encantamientos</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(item.enchantments)
                      .filter(([, v]) => v > 0)
                      .map(([key, val]) => {
                        const meta = RUNE_META[key]
                        const count = meta ? Math.round(val / meta.base) : 1
                        const color = meta?.color ?? '#6b7280'
                        return (
                          <span key={key}
                            className="text-[11px] font-bold px-2 py-1 rounded-md border"
                            style={{ color, background: `color-mix(in srgb,${color} 10%,var(--surface))`, borderColor: `color-mix(in srgb,${color} 30%,var(--border))` }}>
                            ✨ +{val} {meta?.label ?? key}{count > 1 ? ` ×${count}` : ''}
                          </span>
                        )
                      })}
                  </div>
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

            </div>

        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
