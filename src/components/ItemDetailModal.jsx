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

const RARITY_META = {
  common:    { label: 'Común',       color: '#6b7280' },
  uncommon:  { label: 'Poco común',  color: '#16a34a' },
  rare:      { label: 'Raro',        color: '#2563eb' },
  epic:      { label: 'Épico',       color: '#7c3aed' },
  legendary: { label: 'Legendario',  color: '#d97706' },
}

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

export function ItemDetailModal({ item, onClose }) {
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

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
      onClick={onClose}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 overflow-hidden"
        style={{ width: 'min(400px, 92vw)' }}
        variants={sheetVariants()} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2">
            <SlotIcon size={16} strokeWidth={1.8} className="text-text-3" />
            <span className="text-[16px] font-bold text-text">{catalog.name}</span>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded border"
              style={{ color: rarity.color, borderColor: `color-mix(in srgb, ${rarity.color} 30%, var(--border))`, background: `color-mix(in srgb, ${rarity.color} 8%, var(--surface))` }}>
              {rarity.label}
            </span>
            <span className="text-[11px] font-bold text-text-3 bg-surface-2 border border-border px-2 py-0.5 rounded">T{catalog.tier}</span>
            <span className="text-[11px] text-text-3">{slot?.label}</span>
            {catalog.is_two_handed && <span className="text-[11px] font-semibold text-[#d97706]">2 manos</span>}
          </div>

          {/* Description */}
          {catalog.description && (
            <p className="text-[14px] text-text-2 italic leading-relaxed">{catalog.description}</p>
          )}

          {/* Stats */}
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

          {/* Durability */}
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
      </motion.div>
    </motion.div>,
    document.body
  )
}
