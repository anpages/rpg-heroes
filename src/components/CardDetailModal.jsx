import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Sword, Shield, Wind, Brain, Wrench, Shuffle } from 'lucide-react'

const CATEGORY_META = {
  offense:   { label: 'Ofensa',      color: '#f97316', bg: 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)', icon: Sword    },
  defense:   { label: 'Resistencia', color: '#94a3b8', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', icon: Shield   },
  mobility:  { label: 'Movilidad',   color: '#60a5fa', bg: 'linear-gradient(135deg, #0c1445 0%, #1e3a8a 100%)', icon: Wind     },
  equipment: { label: 'Equipo',      color: '#fbbf24', bg: 'linear-gradient(135deg, #1c1003 0%, #422006 100%)', icon: Wrench   },
  hybrid:    { label: 'Híbrida',     color: '#c084fc', bg: 'linear-gradient(135deg, #1a0533 0%, #3b0764 100%)', icon: Shuffle  },
}

const STAT_LABELS = {
  attack: 'Ataque', defense: 'Defensa', max_hp: 'HP', strength: 'Fuerza',
  agility: 'Agilidad', intelligence: 'Inteligencia',
  weapon_attack_amp: 'Amp. arma', armor_defense_amp: 'Amp. armadura',
  durability_loss: 'Durabilidad', item_drop_rate: 'Drop rate',
}

const RANK_LABELS = ['', 'I', 'II', 'III', 'IV', 'V']
const CLASS_LABELS = { caudillo: 'Caudillo', arcanista: 'Arcanista', sombra: 'Sombra', domador: 'Domador' }

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

export function CardDetailModal({ card, onClose }) {
  const sc       = card.skill_cards
  const meta     = CATEGORY_META[sc.card_category ?? sc.category] ?? CATEGORY_META.offense
  const Icon     = meta.icon
  const rank     = Math.min(card.rank ?? 1, 5)
  const bonuses  = Array.isArray(sc.bonuses)   ? sc.bonuses   : []
  const penalties = Array.isArray(sc.penalties) ? sc.penalties : []

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/65 z-[200] flex items-center justify-center p-8"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
      onClick={onClose}
    >
      <motion.div
        className="relative flex flex-col rounded-2xl border border-white/10 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        style={{ background: meta.bg, width: 'min(240px, 72vw)', aspectRatio: '3/4' }}
        variants={sheetVariants()} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
          onClick={onClose}
        >
          <X size={12} strokeWidth={2.5} className="text-white/70" />
        </button>

        {/* Category */}
        <div className="flex items-center gap-1.5 px-4 pt-4 pb-1">
          <Icon size={13} strokeWidth={2} style={{ color: meta.color }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
          {sc.required_class && (
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-[#e879f9]">
              {CLASS_LABELS[sc.required_class] ?? sc.required_class}
            </span>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 flex flex-col justify-center px-4">
          <span className="text-[22px] font-black text-white leading-tight tracking-tight">{sc.name}</span>
        </div>

        {/* Rank dots */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full border"
                style={{ background: i < rank ? meta.color : 'transparent', borderColor: i < rank ? meta.color : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
          <span className="text-[13px] font-black" style={{ color: meta.color }}>Rango {RANK_LABELS[rank] ?? rank}</span>
        </div>

        {/* Stats */}
        {(bonuses.length > 0 || penalties.length > 0) && (
          <div className="flex flex-col gap-1.5 px-4 pb-4 border-t border-white/10 pt-3">
            {bonuses.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-[13px] font-semibold">
                <span className="text-white/50">{STAT_LABELS[b.stat] ?? b.stat}</span>
                <span className="text-[#86efac] font-bold">+{b.value * rank}</span>
              </div>
            ))}
            {penalties.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-[13px] font-semibold">
                <span className="text-white/50">{STAT_LABELS[p.stat] ?? p.stat}</span>
                <span className="text-[#fca5a5] font-bold">−{p.value * rank}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
