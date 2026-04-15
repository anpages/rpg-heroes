import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Coins, Layers, Sparkles, X } from 'lucide-react'
import { DISMANTLE_TABLE, DISMANTLE_RUNE_BONUS } from '../lib/gameConstants'

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

const RUNE_BASE = { attack_bonus: 10, defense_bonus: 10, hp_bonus: 80, strength_bonus: 8, agility_bonus: 8, intelligence_bonus: 8 }

function countRunesApplied(enchantments) {
  if (!enchantments) return 0
  return Object.entries(enchantments).reduce((n, [stat, val]) => {
    return n + Math.round(val / (RUNE_BASE[stat] ?? 1))
  }, 0)
}

function computeRewards(item) {
  const base  = DISMANTLE_TABLE[item.item_catalog.rarity] ?? DISMANTLE_TABLE.common
  const tier  = item.item_catalog.tier ?? 1
  const runes = countRunesApplied(item.enchantments)
  return {
    gold:      base.gold      * tier + runes * DISMANTLE_RUNE_BONUS.gold,
    mana:      base.mana      * tier + runes * DISMANTLE_RUNE_BONUS.mana,
    fragments: base.fragments * tier,
    essence:   base.essence   * tier,
  }
}

export default function DismantleChoiceModal({ item, onConfirm, onCancel }) {
  if (!item) return null
  const rewards = computeRewards(item)
  const rewardRows = [
    { label: 'Oro',         value: rewards.gold,      icon: Coins,     color: '#d97706' },
    { label: 'Maná',        value: rewards.mana,      icon: Sparkles,  color: '#7c3aed' },
    { label: 'Fragmentos',  value: rewards.fragments,  icon: Layers,    color: '#0891b2' },
    { label: 'Esencia',     value: rewards.essence,    icon: Sparkles,  color: '#16a34a' },
  ].filter(r => r.value > 0)

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center sm:p-5"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={{ duration: 0.15 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 p-5 w-full"
        style={{ maxWidth: 'min(360px, 100vw)' }}
        variants={sheetVariants} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-text">Desmantelar</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3 hover:text-text hover:bg-surface-2 transition-colors" onClick={onCancel}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <p className="text-[13px] text-text-2">
          <span className="font-semibold text-text">{item.item_catalog.name}</span> se destruirá permanentemente y obtendrás:
        </p>

        <div className="flex flex-col gap-2">
          {rewardRows.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface border border-border">
              <div className="flex items-center gap-2">
                <Icon size={14} strokeWidth={2} style={{ color }} />
                <span className="text-[13px] text-text-2">{label}</span>
              </div>
              <span className="text-[14px] font-bold" style={{ color }}>+{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--danger btn--sm" onClick={onConfirm}>Desmantelar</button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}
