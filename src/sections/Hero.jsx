import { useState, useEffect, useReducer } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useHeroCards } from '../hooks/useHeroCards'
import { useBuildings } from '../hooks/useBuildings'
import { usePotions } from '../hooks/usePotions'
import {
  Sword, Shield, Heart, Dumbbell, Wind, Brain, CircleDot,
  Crown, Shirt, Hand, Move, Gem, Trash2, Backpack, X,
  BookOpen, Zap, FlameKindling, Wrench, Plus,
} from 'lucide-react'
import { interpolateHp } from '../lib/hpInterpolation'
import { motion, AnimatePresence } from 'framer-motion'

const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

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

const sheetTransition   = { type: 'spring', stiffness: 260, damping: 26 }
const overlayTransition = { duration: 0.25, ease: 'easeOut' }

/* ─── Stat bars ───────────────────────────────────────────────────────────────── */

const STAT_BARS = [
  { key: 'attack',       label: 'Ataque',   Icon: Sword,    color: '#d97706' },
  { key: 'defense',      label: 'Defensa',  Icon: Shield,   color: '#475569' },
  { key: 'strength',     label: 'Fuerza',   Icon: Dumbbell, color: '#dc2626' },
  { key: 'agility',      label: 'Agilidad', Icon: Wind,     color: '#2563eb' },
  { key: 'intelligence', label: 'Intelig.', Icon: Brain,    color: '#7c3aed' },
]

function StatBars({ effective, base }) {
  const maxVal = Math.max(20, ...STAT_BARS.map(s => effective[s.key] ?? 0)) * 1.4

  return (
    <div className="flex flex-col gap-2 pt-3.5 border-t border-border">
      {STAT_BARS.map(({ key, label, Icon, color }) => {
        const total    = effective[key] ?? 0
        const baseV    = base[key]      ?? 0
        const bonus    = total - baseV
        const basePct  = Math.min(100, (baseV  / maxVal) * 100)
        const bonusPct = Math.min(100 - basePct, (bonus / maxVal) * 100)

        return (
          <div key={key} className="grid grid-cols-[14px_68px_1fr_auto] gap-1.5 md:grid-cols-[16px_90px_1fr_auto] md:gap-2 items-center">
            <div className="flex items-center justify-center flex-shrink-0" style={{ color }}>
              <Icon size={13} strokeWidth={2} />
            </div>
            <span className="text-[11px] md:text-[12px] font-semibold text-text-2 whitespace-nowrap">{label}</span>
            <div className="h-[6px] bg-surface-2 border border-border rounded-full overflow-hidden flex">
              <div className="h-full rounded-l-full transition-[width] duration-[400ms]" style={{ width: `${basePct}%`,  background: color, opacity: 0.55 }} />
              <div className="h-full rounded-r-full transition-[width] duration-[400ms]" style={{ width: `${bonusPct}%`, background: color }} />
            </div>
            {bonus > 0
              ? <span className="text-[12px] font-bold text-right whitespace-nowrap">
                  <span className="text-text-3">{baseV}</span>
                  <span className="text-text-3 mx-[3px]">→</span>
                  <span className="text-text">{total}</span>
                </span>
              : <span className="text-[13px] font-bold text-text text-right">{total}</span>
            }
          </div>
        )
      })}
    </div>
  )
}

/* ─── Hero status ─────────────────────────────────────────────────────────────── */

const STATUS_META = {
  idle:      { label: 'En reposo',  color: '#16a34a' },
  exploring: { label: 'Explorando', color: '#d97706' },
  ready:     { label: 'Listo',      color: '#16a34a' },
}

/* ─── Inventory constants ─────────────────────────────────────────────────────── */

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
  common:    { label: 'Común',      color: '#6b7280' },
  uncommon:  { label: 'Poco Común', color: '#16a34a' },
  rare:      { label: 'Raro',       color: '#2563eb' },
  epic:      { label: 'Épico',      color: '#7c3aed' },
  legendary: { label: 'Legendario', color: '#d97706' },
}

const EQUIPMENT_SLOTS   = ['helmet', 'chest', 'arms', 'legs', 'main_hand', 'off_hand', 'accessory', 'accessory_2']
const INVENTORY_BASE_LIMIT = 20

const REPAIR_COST_TABLE = {
  common:    { gold: 2,  mana: 0  },
  uncommon:  { gold: 3,  mana: 1  },
  rare:      { gold: 5,  mana: 3  },
  epic:      { gold: 8,  mana: 6  },
  legendary: { gold: 12, mana: 10 },
}

const DISMANTLE_MANA_TABLE = {
  common:    3,
  uncommon:  8,
  rare:      20,
  epic:      50,
  legendary: 120,
}

function estimateDismantleMana(item) {
  const base = DISMANTLE_MANA_TABLE[item.item_catalog.rarity] ?? DISMANTLE_MANA_TABLE.common
  return base * (item.item_catalog.tier ?? 1)
}

function estimateRepairCost(item) {
  const catalog = item.item_catalog
  const missing = catalog.max_durability - item.current_durability
  const costs   = REPAIR_COST_TABLE[catalog.rarity] ?? REPAIR_COST_TABLE.common
  return {
    gold: Math.ceil(missing * costs.gold),
    mana: Math.ceil(missing * costs.mana),
  }
}

/* ─── Shared sub-components ───────────────────────────────────────────────────── */

function XpBar({ level, experience }) {
  const needed = level * 150
  const pct    = Math.min(100, Math.round((experience / needed) * 100))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px] font-semibold text-text-2">
        <span>Nivel {level}</span>
        <span>{experience} / {needed} XP</span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-[linear-gradient(90deg,var(--btn-primary),var(--btn-primary-hover))] rounded-full transition-[width] duration-[400ms]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function HpBar({ current, max, recovering = false }) {
  const pct   = Math.min(100, Math.round((current / max) * 100))
  const color = recovering ? '#0369a1' : pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  const lowHpCombat  = pct < 20
  const lowHpExplore = current < 7
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-[13px] font-semibold text-text-2">
        <span className="flex items-center gap-[5px]"><Heart size={13} strokeWidth={2} color={color} /> HP</span>
        <span className="text-text-3 font-medium" style={{ color }}>{current} / {max}</span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width,background] duration-[400ms]${recovering ? ' animate-hp-regen-pulse' : ''}`}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {lowHpCombat && !recovering && (
        <p className="text-[12px] text-[#dc2626] font-medium -mt-0.5">
          {lowHpExplore
            ? 'HP bajo — el héroe no puede combatir ni explorar. ¡Descansa!'
            : 'HP bajo — el héroe no puede combatir. Las expediciones aún son posibles.'}
        </p>
      )}
    </div>
  )
}

function DurabilityBar({ current, max }) {
  const pct   = max > 0 ? Math.round((current / max) * 100) : 0
  const color = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  return (
    <div className="w-full h-[3px] bg-border rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-[width] duration-[300ms]" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

/* ─── Common modal panel & overlay ───────────────────────────────────────────── */

function ModalOverlay({ onClick, children }) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/55 z-[200] flex overflow-hidden items-end justify-center p-0 sm:items-center sm:p-5"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}

function ModalPanel({ onClick, children, sv }) {
  return (
    <motion.div
      className="bg-bg border border-border-2 w-full flex flex-col gap-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-y-auto overscroll-contain
        rounded-t-[20px] sm:rounded-[14px]
        max-w-full sm:max-w-[700px]
        max-h-[88vh] sm:max-h-[80vh]
        px-4 pt-5 pb-[max(32px,env(safe-area-inset-bottom))] sm:p-6
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      variants={sv} initial="initial" animate="animate" exit="exit"
      transition={sheetTransition}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}

function ModalHeader({ icon: Icon, title, subtitle, onClose }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-text">
        <Icon size={18} strokeWidth={1.8} />
        <span className="text-[16px] font-bold">{title}</span>
        {subtitle && <span className="text-[13px] font-semibold text-text-3">{subtitle}</span>}
      </div>
      <button className="btn btn--ghost btn--icon" onClick={onClose}><X size={18} strokeWidth={2} /></button>
    </div>
  )
}

/* ─── Confirm modal ───────────────────────────────────────────────────────────── */

function ConfirmModal({ title, body, confirmLabel = 'Confirmar', onConfirm, onCancel }) {
  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[2000] p-4"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
      onClick={onCancel}
    >
      <motion.div
        className="bg-surface border border-border rounded-[14px] p-6 w-[min(100%,340px)] shadow-[var(--shadow-lg)] flex flex-col gap-3"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6 }}
        transition={sheetTransition}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[15px] font-bold text-text">{title}</p>
        {body && <p className="text-[13px] text-text-2">{body}</p>}
        <div className="flex gap-2 justify-end mt-1">
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--primary btn--sm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Stats list ──────────────────────────────────────────────────────────────── */

function StatsList({ catalog, hideEmpty }) {
  const stats = [
    { key: 'attack_bonus',       label: 'Atq' },
    { key: 'defense_bonus',      label: 'Def' },
    { key: 'hp_bonus',           label: 'HP'  },
    { key: 'strength_bonus',     label: 'Fue' },
    { key: 'agility_bonus',      label: 'Agi' },
    { key: 'intelligence_bonus', label: 'Int' },
  ].filter(s => catalog[s.key] > 0)

  if (!stats.length) return hideEmpty ? null : <span className="text-[13px] text-text-3">Sin bonificaciones</span>
  return (
    <div className="flex flex-wrap gap-1">
      {stats.map(s => (
        <span key={s.key} className="text-[11px] font-semibold text-text-2 bg-surface-2 rounded-[4px] px-[5px] py-px">+{catalog[s.key]} {s.label}</span>
      ))}
    </div>
  )
}

/* ─── Equipment slot ──────────────────────────────────────────────────────────── */

function EquipmentSlot({ slot, item, onSlotClick, onRepair, loading, isOccupied }) {
  const meta    = SLOT_META[slot]
  const Icon    = meta.icon
  const catalog = item?.item_catalog
  const rarity  = catalog ? RARITY_META[catalog.rarity] : null
  const durPct  = item ? Math.round((item.current_durability / catalog.max_durability) * 100) : 100

  const isCritical  = item && durPct > 0 && durPct <= 25
  const isBroken    = item && durPct === 0
  const needsRepair = item && durPct < 100

  const borderClass = isBroken
    ? 'border-error-border bg-error-bg'
    : isCritical
      ? 'border-warning-border bg-warning-bg'
      : item
        ? 'border-border-2 border-[color-mix(in_srgb,var(--eq-color)_35%,var(--border))]'
        : 'border-border'

  return (
    <div
      role="button"
      tabIndex={0}
      className={`bg-surface border rounded-[10px] py-[9px] px-[11px] flex flex-col gap-1 transition-[border-color] duration-150 w-full text-left cursor-pointer hover:border-border-2 ${borderClass}`}
      onClick={() => onSlotClick(slot)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick(slot) } }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={13} strokeWidth={1.8} className="text-text-3" />
        <span className="text-[13px] font-bold uppercase tracking-[0.07em] text-text-3">{meta.label}</span>
        {isBroken   && <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.06em] px-[5px] py-px rounded border text-[#dc2626] bg-error-bg border-error-border">Roto</span>}
        {isCritical && <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.06em] px-[5px] py-px rounded border text-warning-text bg-warning-bg border-warning-border">Crítico</span>}
      </div>
      {item ? (
        <>
          <p className="text-[13px] font-semibold leading-[1.2] mb-1" style={{ color: rarity?.color }}>{catalog.name}</p>
          <StatsList catalog={catalog} hideEmpty />
          <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
          {needsRepair && (
            <div className="flex items-center justify-between mt-0.5">
              <button
                className="btn btn--ghost btn--icon text-warning-text border-warning-border hover:border-warning-text hover:bg-[color-mix(in_srgb,var(--warning-text)_8%,transparent)] hover:text-warning-text"
                onClick={e => { e.stopPropagation(); onRepair(item) }}
                disabled={loading || isOccupied}
                title={isOccupied ? 'El héroe está en expedición' : 'Reparar'}
              >
                <Wrench size={13} strokeWidth={2} />
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-text-3 italic">Vacío</p>
      )}
    </div>
  )
}

/* ─── Bag item ────────────────────────────────────────────────────────────────── */

function BagItem({ item, onDiscard, loading, isOccupied }) {
  const catalog  = item.item_catalog
  const rarity   = RARITY_META[catalog.rarity]
  const slotMeta = SLOT_META[catalog.slot]

  return (
    <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-1.5 transition-[border-color] duration-150 hover:border-border-2">
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-[13px] font-bold leading-[1.3] flex-1" style={{ color: rarity.color }}>{catalog.name}</span>
        <span className="text-[10px] font-bold bg-surface-2 border border-border rounded-[4px] px-[5px] py-px text-text-2 flex-shrink-0">T{catalog.tier}</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold" style={{ color: rarity.color }}>{rarity.label}</span>
        <span className="text-[11px] font-semibold text-text-3">{slotMeta.label}</span>
        {catalog.is_two_handed && <span className="text-[11px] font-semibold text-[#d97706]">2 manos</span>}
      </div>
      <StatsList catalog={catalog} />
      <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
      <div className="flex gap-1.5 mt-0.5">
        <button className="btn btn--danger btn--icon" onClick={() => onDiscard(item)} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : undefined}>
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

/* ─── Common modal content helpers ───────────────────────────────────────────── */

function LockedNotice() {
  return <p className="text-[12px] text-[#d97706] bg-[color-mix(in_srgb,#d97706_8%,var(--surface))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] rounded-lg px-3 py-2 text-center">El héroe está en expedición — el equipo no se puede modificar.</p>
}

function LockedCardsNotice() {
  return <p className="text-[12px] text-[#d97706] bg-[color-mix(in_srgb,#d97706_8%,var(--surface))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] rounded-lg px-3 py-2 text-center">El héroe está en expedición — las cartas no se pueden modificar.</p>
}

function InvError({ msg }) {
  return <p className="text-[13px] text-[#dc2626] bg-error-bg border border-error-border rounded-lg px-[14px] py-[10px]">{msg}</p>
}

function BagEmpty({ children }) {
  return <p className="text-[14px] text-text-3 py-10 px-5 text-center bg-surface border border-dashed border-border rounded-xl">{children}</p>
}

/* ─── Bag modal ───────────────────────────────────────────────────────────────── */

function BagModal({ bag, bagLimit, onDiscard, loading, error, onClose, isOccupied }) {
  const sv = sheetVariants()
  return createPortal(
    <ModalOverlay onClick={onClose}>
      <ModalPanel sv={sv} onClick={e => e.stopPropagation()}>
        <ModalHeader icon={Backpack} title="Mochila" subtitle={`${bag.length} / ${bagLimit}`} onClose={onClose} />
        {error      && <InvError msg={error} />}
        {isOccupied && <LockedNotice />}
        {bag.length === 0
          ? <BagEmpty>La mochila está vacía. Explora mazmorras para conseguir equipo.</BagEmpty>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
              {bag.map(item => (
                <BagItem key={item.id} item={item} onDiscard={onDiscard} loading={loading} isOccupied={isOccupied} />
              ))}
            </div>
          )
        }
      </ModalPanel>
    </ModalOverlay>,
    document.body
  )
}

/* ─── Card constants ──────────────────────────────────────────────────────────── */

const CATEGORY_META = {
  attack:       { label: 'Ataque',   short: 'Atq', color: '#d97706', icon: Sword    },
  defense:      { label: 'Defensa',  short: 'Def', color: '#475569', icon: Shield   },
  strength:     { label: 'Fuerza',   short: 'Fue', color: '#dc2626', icon: Dumbbell },
  agility:      { label: 'Agilidad', short: 'Agi', color: '#0369a1', icon: Wind     },
  intelligence: { label: 'Int.',     short: 'Int', color: '#7c3aed', icon: Brain    },
}

/* ─── Card budget bar ─────────────────────────────────────────────────────────── */

function CardBudgetBar({ category, used, total }) {
  const meta  = CATEGORY_META[category]
  const Icon  = meta.icon
  const pct   = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const over  = used > total
  const color = over ? '#dc2626' : meta.color
  return (
    <div className="bg-surface-2 border border-border rounded-[7px] px-2 py-[5px]" title={`${meta.label}: ${used}/${total}`}>
      <div className="flex items-center gap-[5px]">
        <span className="flex items-center flex-shrink-0" style={{ color }}><Icon size={11} strokeWidth={2.2} /></span>
        <span className="text-[11px] font-bold tracking-[0.04em] flex-shrink-0 w-[22px]" style={{ color }}>{meta.short}</span>
        <div className="flex-1 h-[3px] bg-border rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-[300ms]" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className={`text-[11px] font-semibold flex-shrink-0 whitespace-nowrap ${over ? 'text-[#dc2626]' : 'text-text-3'}`}>{used}/{total}</span>
      </div>
    </div>
  )
}

/* ─── Equipped card chip ──────────────────────────────────────────────────────── */

function CardChip({ card, onClick, loading, isOccupied }) {
  const sc   = card.skill_cards
  const meta = CATEGORY_META[sc.category]
  return (
    <button
      className="bg-surface-2 border border-[color-mix(in_srgb,var(--card-color)_25%,var(--border))] rounded-lg px-[10px] py-2 flex flex-col gap-[3px] cursor-pointer transition-[border-color] duration-150 w-full text-left hover:border-text-2"
      style={{ '--card-color': meta.color }}
      onClick={onClick}
      disabled={loading}
      title={isOccupied ? 'El héroe está en expedición' : 'Gestionar carta'}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[13px] font-bold text-text leading-[1.2] flex-1">{sc.name}</span>
        <span className="text-[13px] font-bold text-[var(--card-color)] bg-[color-mix(in_srgb,var(--card-color)_10%,transparent)] border border-[color-mix(in_srgb,var(--card-color)_25%,transparent)] rounded-[4px] px-[5px] py-px flex-shrink-0">R{card.rank}</span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[13px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        <span className="text-[13px] text-text-3">{sc.base_cost * card.rank} pts</span>
      </div>
    </button>
  )
}

/* ─── Card item ───────────────────────────────────────────────────────────────── */

function CardItem({ card, canEquip, canFuseWith, onEquip, onUnequip, onFuse, loading, isOccupied }) {
  const sc   = card.skill_cards
  const meta = CATEGORY_META[sc.category]
  const Icon = meta.icon
  const effects = [
    sc.attack_bonus       > 0 && `+${sc.attack_bonus       * card.rank} Atq`,
    sc.defense_bonus      > 0 && `+${sc.defense_bonus      * card.rank} Def`,
    sc.hp_bonus           > 0 && `+${sc.hp_bonus           * card.rank} HP`,
    sc.strength_bonus     > 0 && `+${sc.strength_bonus     * card.rank} Fue`,
    sc.agility_bonus      > 0 && `+${sc.agility_bonus      * card.rank} Agi`,
    sc.intelligence_bonus > 0 && `+${sc.intelligence_bonus * card.rank} Int`,
  ].filter(Boolean)

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-[10px] p-3 transition-[border-color] duration-150 border
        ${card.equipped
          ? 'border-[color-mix(in_srgb,var(--card-color)_40%,var(--border))] bg-[color-mix(in_srgb,var(--card-color)_3%,var(--surface))]'
          : 'bg-surface border-border'
        }`}
      style={{ '--card-color': meta.color }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-[13px] font-bold text-text flex-1 leading-[1.3]">{sc.name}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[13px] font-bold text-[var(--card-color)] bg-[color-mix(in_srgb,var(--card-color)_10%,transparent)] border border-[color-mix(in_srgb,var(--card-color)_25%,transparent)] rounded-[4px] px-[5px] py-px">R{card.rank}</span>
          {canFuseWith && <span className="flex items-center text-[#d97706]"><FlameKindling size={10} strokeWidth={2} /></span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-[3px] text-[13px] font-bold uppercase tracking-[0.05em]" style={{ color: meta.color }}>
          <Icon size={10} strokeWidth={2} /> {meta.label}
        </span>
        <span className="text-[13px] text-text-3 font-semibold">{sc.base_cost * card.rank} pts · {sc.rarity}</span>
      </div>
      {sc.description && <p className="text-[13px] text-text-3 leading-[1.4] italic">{sc.description}</p>}
      {effects.length > 0 && (
        <div className="flex flex-wrap gap-[3px]">
          {effects.map(e => <span key={e} className="text-[13px] font-semibold text-[#16a34a] bg-success-bg border border-success-border rounded-[4px] px-[5px] py-px">{e}</span>)}
        </div>
      )}
      <div className="flex flex-col gap-1 mt-0.5">
        {canFuseWith && !card.equipped && (
          <button className="btn btn--warning btn--sm" onClick={() => onFuse(card.id, canFuseWith.id)} disabled={loading || isOccupied}>
            <FlameKindling size={12} strokeWidth={2} /> Fusionar · {sc.base_mana_fuse * Math.pow(2, card.rank - 1)} maná
          </button>
        )}
        {card.equipped
          ? <button className="btn btn--ghost btn--sm" onClick={() => onUnequip(card.id)} disabled={loading || isOccupied}>Desequipar</button>
          : <button className="btn btn--primary btn--sm" onClick={() => onEquip(card.id)} disabled={loading || !canEquip || isOccupied}>Equipar</button>
        }
      </div>
    </div>
  )
}

/* ─── Card modal ──────────────────────────────────────────────────────────────── */

function CardModal({ cards, hero, cardSlots, onEquip, onUnequip, onFuse, loading, error, onClose, isOccupied }) {
  const equippedCount = cards.filter(c => c.equipped).length

  const fuseMap = {}
  cards.filter(c => !c.equipped).forEach(c => {
    const key = `${c.card_id}-${c.rank}`
    if (!fuseMap[key]) fuseMap[key] = []
    fuseMap[key].push(c)
  })

  const budgetUsed = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0 }
  cards.filter(c => c.equipped).forEach(c => {
    budgetUsed[c.skill_cards.category] += c.skill_cards.base_cost * c.rank
  })

  const sv = sheetVariants()
  return createPortal(
    <ModalOverlay onClick={onClose}>
      <ModalPanel sv={sv} onClick={e => e.stopPropagation()}>
        <ModalHeader icon={BookOpen} title="Colección de Cartas" subtitle={`${cards.length} cartas · ${equippedCount}/${cardSlots} equipadas`} onClose={onClose} />
        {error      && <InvError msg={error} />}
        {isOccupied && <LockedCardsNotice />}
        {cards.length === 0
          ? <BagEmpty>Sin cartas. Explora mazmorras mágicas o antiguas para conseguirlas.</BagEmpty>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
              {cards.map(card => {
                const key      = `${card.card_id}-${card.rank}`
                const fusePair = fuseMap[key]?.find(c => c.id !== card.id)
                const cat      = card.skill_cards.category
                const cost     = card.skill_cards.base_cost * card.rank
                const wouldFit = budgetUsed[cat] + cost <= hero[cat] && equippedCount < cardSlots
                return (
                  <CardItem
                    key={card.id}
                    card={card}
                    canEquip={wouldFit}
                    canFuseWith={!card.equipped ? fusePair : null}
                    onEquip={onEquip}
                    onUnequip={onUnequip}
                    onFuse={onFuse}
                    loading={loading}
                    isOccupied={isOccupied}
                  />
                )
              })}
            </div>
          )
        }
      </ModalPanel>
    </ModalOverlay>,
    document.body
  )
}

/* ─── Slot picker sheet ───────────────────────────────────────────────────────── */

function SlotPickerSheet({ slot, equippedItem, bagItems, onEquip, onUnequip, onRepair, loading, isOccupied, onClose }) {
  const meta = SLOT_META[slot]
  const Icon = meta.icon
  const sv   = sheetVariants()
  const compatible = bagItems.filter(i => i.item_catalog.slot === slot)

  return createPortal(
    <ModalOverlay onClick={onClose}>
      <ModalPanel sv={sv} onClick={e => e.stopPropagation()}>
        <ModalHeader icon={Icon} title={meta.label} onClose={onClose} />
        {isOccupied && <LockedNotice />}

        {equippedItem && (() => {
          const catalog    = equippedItem.item_catalog
          const rarity     = RARITY_META[catalog.rarity]
          const durPct     = Math.round((equippedItem.current_durability / catalog.max_durability) * 100)
          const needsRepair = durPct < 100
          return (
            <div className="bg-surface border border-border rounded-[10px] p-3 -mb-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-[1.2] mb-1" style={{ color: rarity?.color }}>{catalog.name}</p>
                  <StatsList catalog={catalog} />
                  <DurabilityBar current={equippedItem.current_durability} max={catalog.max_durability} />
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {needsRepair && (
                    <button
                      className="btn btn--ghost btn--icon text-warning-text border-warning-border hover:border-warning-text hover:bg-[color-mix(in_srgb,var(--warning-text)_8%,transparent)] hover:text-warning-text"
                      onClick={() => onRepair(equippedItem)}
                      disabled={loading || isOccupied}
                      title={isOccupied ? 'El héroe está en expedición' : 'Reparar'}
                    >
                      <Wrench size={13} strokeWidth={2} />
                    </button>
                  )}
                  <button className="btn btn--ghost btn--sm" onClick={() => onUnequip(equippedItem.id)} disabled={loading || isOccupied}>Desequipar</button>
                </div>
              </div>
            </div>
          )
        })()}

        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-3">Disponible en mochila</p>

        {compatible.length === 0
          ? <BagEmpty>No hay ítems compatibles en la mochila.</BagEmpty>
          : (
            <div className="flex flex-col gap-2">
              {compatible.map(item => {
                const catalog  = item.item_catalog
                const rarity   = RARITY_META[catalog.rarity]
                const durPct   = Math.round((item.current_durability / catalog.max_durability) * 100)
                const disabled = loading || durPct === 0 || isOccupied
                return (
                  <button
                    key={item.id}
                    className={`block w-full text-left bg-surface border border-border rounded-[10px] p-3 transition-[border-color,background] duration-150 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--blue-500)] hover:bg-[color-mix(in_srgb,var(--blue-500)_5%,var(--surface))]'}`}
                    onClick={() => onEquip(item.id)}
                    disabled={disabled}
                    title={isOccupied ? 'El héroe está en expedición' : durPct === 0 ? 'Repara el ítem antes de equiparlo' : ''}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-bold leading-[1.3]" style={{ color: rarity.color }}>{catalog.name}</span>
                      <span className="text-[10px] font-bold bg-surface-2 border border-border rounded-[4px] px-[5px] py-px text-text-2 flex-shrink-0">T{catalog.tier}</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap mb-1">
                      <span className="text-[11px] font-semibold" style={{ color: rarity.color }}>{rarity.label}</span>
                      {catalog.is_two_handed && <span className="text-[11px] font-semibold text-[#d97706]">2 manos</span>}
                    </div>
                    <StatsList catalog={catalog} />
                    <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
                  </button>
                )
              })}
            </div>
          )
        }
      </ModalPanel>
    </ModalOverlay>,
    document.body
  )
}

/* ─── Card picker sheet ───────────────────────────────────────────────────────── */

function CardPickerSheet({ currentCard, cards, hero, cardSlots, onEquip, onUnequip, onFuse, loading, error, isOccupied, onClose }) {
  const equippedCount = cards.filter(c => c.equipped).length

  const fuseMap = {}
  cards.filter(c => !c.equipped).forEach(c => {
    const key = `${c.card_id}-${c.rank}`
    if (!fuseMap[key]) fuseMap[key] = []
    fuseMap[key].push(c)
  })

  const budgetUsed = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0 }
  cards.filter(c => c.equipped).forEach(c => {
    budgetUsed[c.skill_cards.category] += c.skill_cards.base_cost * c.rank
  })

  const sv         = sheetVariants()
  const unequipped = cards.filter(c => !c.equipped)

  return createPortal(
    <ModalOverlay onClick={onClose}>
      <ModalPanel sv={sv} onClick={e => e.stopPropagation()}>
        <ModalHeader icon={BookOpen} title="Cartas de habilidad" onClose={onClose} />
        {error      && <InvError msg={error} />}
        {isOccupied && <LockedCardsNotice />}

        {currentCard && (() => {
          const sc   = currentCard.skill_cards
          const meta = CATEGORY_META[sc.category]
          return (
            <div className="bg-surface border border-border rounded-[10px] p-3 -mb-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-[1.2] mb-1" style={{ color: meta.color }}>{sc.name}</p>
                  <div className="flex gap-1.5 mt-1">
                    <span
                      className="text-[13px] font-bold text-[var(--card-color)] bg-[color-mix(in_srgb,var(--card-color)_10%,transparent)] border border-[color-mix(in_srgb,var(--card-color)_25%,transparent)] rounded-[4px] px-[5px] py-px"
                      style={{ '--card-color': meta.color }}
                    >R{currentCard.rank}</span>
                    <span className="text-[13px] text-text-3 font-semibold">{sc.base_cost * currentCard.rank} pts</span>
                  </div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => onUnequip(currentCard.id)} disabled={loading || isOccupied}>Desequipar</button>
              </div>
            </div>
          )
        })()}

        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-3">Disponible</p>

        {unequipped.length === 0
          ? <BagEmpty>No hay cartas disponibles para equipar.</BagEmpty>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
              {unequipped.map(card => {
                const key      = `${card.card_id}-${card.rank}`
                const fusePair = fuseMap[key]?.find(c => c.id !== card.id)
                const cat      = card.skill_cards.category
                const cost     = card.skill_cards.base_cost * card.rank
                const wouldFit = budgetUsed[cat] + cost <= hero[cat] && equippedCount < cardSlots
                return (
                  <CardItem
                    key={card.id}
                    card={card}
                    canEquip={wouldFit}
                    canFuseWith={fusePair ?? null}
                    onEquip={onEquip}
                    onUnequip={onUnequip}
                    onFuse={onFuse}
                    loading={loading}
                    isOccupied={isOccupied}
                  />
                )
              })}
            </div>
          )
        }
      </ModalPanel>
    </ModalOverlay>,
    document.body
  )
}

/* ─── Main component ──────────────────────────────────────────────────────────── */


function Hero() {
  const userId      = useAppStore(s => s.userId)
  const heroId      = useHeroId()
  const queryClient = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { items, loading: invLoading  } = useInventory(hero?.id)
  const { cards, loading: cardsLoading } = useHeroCards(hero?.id)
  const { buildings } = useBuildings(userId)
  const [bagOpen,       setBagOpen]       = useState(false)
  const [slotPicker,    setSlotPicker]    = useState(null)
  const [cardPickerOpen, setCardPickerOpen] = useState(false)
  const [cardModalOpen, setCardModalOpen] = useState(false)
  const [confirmModal,  setConfirmModal]  = useState(null)
  const [workshopLevel, setWorkshopLevel] = useState(1)
  const [libraryLevel,  setLibraryLevel]  = useState(1)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  const itemMutation = useMutation({
    mutationFn: ({ endpoint, body }) => apiPost(endpoint, body),
    onMutate: async ({ optimisticUpdate }) => {
      if (!optimisticUpdate) return
      const key = queryKeys.inventory(hero?.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, optimisticUpdate)
      return { previous }
    },
    onError: (err, vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKeys.inventory(hero?.id), context.previous)
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(hero?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
  })

  const cardMutation = useMutation({
    mutationFn: ({ endpoint, body }) => apiPost(endpoint, body),
    onMutate: async ({ optimisticUpdate }) => {
      if (!optimisticUpdate) return
      const key = queryKeys.heroCards(hero?.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, optimisticUpdate)
      return { previous }
    },
    onError: (err, vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKeys.heroCards(hero?.id), context.previous)
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroCards(hero?.id) })
    },
  })

  const potionMutation = useMutation({
    mutationFn: (potionId) => apiPost('/api/potion-use', { heroId: hero?.id, potionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.potions(hero?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      toast.success('¡Poción usada!')
    },
    onError: err => toast.error(err.message),
  })

  const { potions } = usePotions(hero?.id)
  const hpPotions = (potions ?? []).filter(p => p.effect_type === 'hp_restore')

  const mutationPending = itemMutation.isPending || cardMutation.isPending

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!buildings) return
    buildings.forEach(b => {
      if (b.type === 'workshop') setWorkshopLevel(b.level)
      if (b.type === 'library')  setLibraryLevel(b.level)
    })
  }, [buildings])

  if (heroLoading || invLoading || cardsLoading) return null
  if (!hero) return (
    <div className="text-text-3 text-[15px] p-10 text-center">
      {heroId ? 'No se encontró el héroe.' : 'Recluta tu primer héroe para comenzar.'}
    </div>
  )

  const cls      = hero.classes
  const status   = STATUS_META[hero.status] ?? STATUS_META.idle
  const isOccupied = hero.status === 'exploring'

  const equipped = EQUIPMENT_SLOTS.reduce((acc, slot) => {
    acc[slot] = items?.find(i => i.equipped_slot === slot) ?? null
    return acc
  }, {})

  const equipBonuses = (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .reduce((acc, i) => {
      const c = i.item_catalog
      acc.attack       += c.attack_bonus       ?? 0
      acc.defense      += c.defense_bonus      ?? 0
      acc.max_hp       += c.hp_bonus           ?? 0
      acc.strength     += c.strength_bonus     ?? 0
      acc.agility      += c.agility_bonus      ?? 0
      acc.intelligence += c.intelligence_bonus ?? 0
      return acc
    }, { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0, intelligence: 0 })

  const cardBonuses = (cards ?? [])
    .filter(c => c.equipped)
    .reduce((acc, c) => {
      const sc = c.skill_cards
      const r  = c.rank
      acc.attack       += (sc.attack_bonus       ?? 0) * r
      acc.defense      += (sc.defense_bonus      ?? 0) * r
      acc.max_hp       += (sc.hp_bonus           ?? 0) * r
      acc.strength     += (sc.strength_bonus     ?? 0) * r
      acc.agility      += (sc.agility_bonus      ?? 0) * r
      acc.intelligence += (sc.intelligence_bonus ?? 0) * r
      return acc
    }, { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0, intelligence: 0 })

  const bonuses = {
    attack:       equipBonuses.attack       + cardBonuses.attack,
    defense:      equipBonuses.defense      + cardBonuses.defense,
    max_hp:       equipBonuses.max_hp       + cardBonuses.max_hp,
    strength:     equipBonuses.strength     + cardBonuses.strength,
    agility:      equipBonuses.agility      + cardBonuses.agility,
    intelligence: equipBonuses.intelligence + cardBonuses.intelligence,
  }

  const effective = {
    attack:       hero.attack       + bonuses.attack,
    defense:      hero.defense      + bonuses.defense,
    max_hp:       hero.max_hp       + bonuses.max_hp,
    strength:     hero.strength     + bonuses.strength,
    agility:      hero.agility      + bonuses.agility,
    intelligence: hero.intelligence + bonuses.intelligence,
  }

  const cardBudgetUsed = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0 }
  ;(cards ?? []).filter(c => c.equipped).forEach(c => {
    cardBudgetUsed[c.skill_cards.category] += c.skill_cards.base_cost * c.rank
  })
  const cardSlotCount = 1 + libraryLevel * 2

  // eslint-disable-next-line react-hooks/purity
  const hpNow    = interpolateHp(hero, Date.now(), effective.max_hp)
  const bag      = items?.filter(i => !i.equipped_slot) ?? []
  const bagLimit = INVENTORY_BASE_LIMIT + (workshopLevel - 1) * 5

  function handleEquip(itemId) {
    const item = items?.find(i => i.id === itemId)
    if (!item) return
    const targetSlot = item.item_catalog.slot
    itemMutation.mutate({
      endpoint: '/api/item-equip',
      body: { itemId, equip: true },
      optimisticUpdate: items?.map(i => {
        if (i.id === itemId) return { ...i, equipped_slot: targetSlot }
        if (i.equipped_slot === targetSlot) return { ...i, equipped_slot: null }
        if (item.item_catalog.is_two_handed && i.equipped_slot === 'off_hand') return { ...i, equipped_slot: null }
        return i
      }),
    })
  }

  function handleUnequip(itemId) {
    itemMutation.mutate({
      endpoint: '/api/item-equip',
      body: { itemId, equip: false },
      optimisticUpdate: items?.map(i => i.id === itemId ? { ...i, equipped_slot: null } : i),
    })
  }

  function handleRepair(item) {
    const cost = estimateRepairCost(item)
    const costText = cost.mana > 0 ? `${cost.gold} oro · ${cost.mana} maná` : `${cost.gold} oro`
    setConfirmModal({
      title: `Reparar ${item.item_catalog.name}`,
      body: `Coste estimado: ${costText}`,
      confirmLabel: 'Reparar',
      onConfirm: () => {
        setConfirmModal(null)
        itemMutation.mutate({ endpoint: '/api/item-repair', body: { itemId: item.id } })
      },
    })
  }

  function handleDiscard(item) {
    const mana = estimateDismantleMana(item)
    setConfirmModal({
      title: `Desmantelar ${item.item_catalog.name}`,
      body: `El item se destruirá y recuperarás ${mana} maná.`,
      confirmLabel: 'Desmantelar',
      onConfirm: () => {
        setConfirmModal(null)
        itemMutation.mutate({
          endpoint: '/api/item-dismantle',
          body: { itemId: item.id },
          optimisticUpdate: items?.filter(i => i.id !== item.id),
        })
      },
    })
  }

  function handleCardEquip(cardId) {
    cardMutation.mutate({
      endpoint: '/api/card-equip',
      body: { cardId, equip: true },
      optimisticUpdate: cards?.map(c => c.id === cardId ? { ...c, equipped: true } : c),
    })
  }

  function handleCardUnequip(cardId) {
    cardMutation.mutate({
      endpoint: '/api/card-equip',
      body: { cardId, equip: false },
      optimisticUpdate: cards?.map(c => c.id === cardId ? { ...c, equipped: false } : c),
    })
  }

  function handleCardFuse(id1, id2) {
    cardMutation.mutate({
      endpoint: '/api/card-fuse',
      body: { cardId1: id1, cardId2: id2 },
      optimisticUpdate: cards?.filter(c => c.id !== id1 && c.id !== id2),
    })
  }

  return (
    <motion.div key="hero-content" className="pt-[4px] overflow-x-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 items-start">

        {/* Left column: hero card + cards */}
        <div className="flex flex-col gap-4">

          {/* Hero card */}
          <div className="bg-surface border border-border rounded-xl p-4 md:p-6 shadow-[var(--shadow-sm)] flex flex-col gap-3.5 md:gap-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                <Sword size={32} strokeWidth={1.5} color={cls?.color} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-hero text-[20px] md:text-[24px] font-bold tracking-[0.02em] text-text leading-none">{hero.name}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-[6px]"
                    style={{
                      color: cls?.color ?? 'var(--text-2)',
                      background: `color-mix(in srgb, ${cls?.color ?? 'transparent'} 12%, var(--surface))`,
                      border: `1px solid color-mix(in srgb, ${cls?.color ?? 'transparent'} 28%, var(--border))`,
                    }}
                  >
                    {cls?.name}
                  </span>
                  <span className="flex items-center gap-1 text-[13px] font-medium text-text-3" style={{ color: status.color }}>
                    <CircleDot size={10} strokeWidth={2.5} />
                    {status.label}
                  </span>
                </div>
              </div>
            </div>

            <XpBar level={hero.level} experience={hero.experience} />
            <HpBar current={hpNow ?? hero.current_hp} max={effective.max_hp} recovering={hero.status === 'idle'} />

            {hpPotions.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {hpPotions.map(p => {
                  const empty    = p.quantity <= 0
                  const full     = hpNow >= effective.max_hp
                  const disabled = empty || full || potionMutation.isPending
                  return (
                    <motion.button
                      key={p.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-[opacity] duration-150 disabled:opacity-40"
                      style={{
                        color:       'var(--text-2)',
                        borderColor: 'var(--border)',
                        background:  'var(--surface-2)',
                      }}
                      onClick={() => !disabled && potionMutation.mutate(p.id)}
                      disabled={disabled}
                      whileTap={disabled ? {} : { scale: 0.95 }}
                    >
                      <Heart size={11} strokeWidth={2.5} style={{ color: '#16a34a' }} />
                      {p.name}
                      <span className="opacity-60">×{p.quantity}</span>
                    </motion.button>
                  )
                })}
              </div>
            )}

            <StatBars
              effective={{ attack: effective.attack, defense: effective.defense, strength: effective.strength, agility: effective.agility, intelligence: effective.intelligence }}
              base={{ attack: hero.attack, defense: hero.defense, strength: hero.strength, agility: hero.agility, intelligence: hero.intelligence }}
            />
          </div>

          {/* Cards section */}
          <div className="flex flex-col gap-3 p-4 md:p-5 bg-surface border border-border rounded-xl shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.08em] text-text-3">
                <BookOpen size={14} strokeWidth={2} />
                Cartas de Habilidad
              </p>
              <button className="btn btn--ghost btn--sm" onClick={() => setCardModalOpen(true)}>
                <Zap size={13} strokeWidth={2} />
                Colección {(cards ?? []).length}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 md:grid-cols-2 md:gap-1.5">
              {['attack', 'defense', 'strength', 'agility', 'intelligence'].map(cat => (
                <CardBudgetBar key={cat} category={cat} used={cardBudgetUsed[cat]} total={hero[cat]} />
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
              {Array.from({ length: cardSlotCount }).map((_, idx) => {
                const card = (cards ?? []).filter(c => c.equipped)[idx] ?? null
                return card ? (
                  <CardChip
                    key={card.id}
                    card={card}
                    onClick={() => setCardPickerOpen({ currentCard: card })}
                    loading={mutationPending}
                    isOccupied={isOccupied}
                  />
                ) : (
                  <button
                    key={`empty-card-${idx}`}
                    className="flex items-center justify-center gap-1.5 p-[10px] border border-dashed border-border-2 rounded-[10px] bg-transparent text-text-3 text-[13px] font-medium cursor-pointer w-full transition-[border-color,color] duration-150 hover:border-text-2 hover:text-text"
                    onClick={() => setCardPickerOpen({ currentCard: null })}
                  >
                    <Plus size={13} strokeWidth={2} />
                    Equipar carta
                  </button>
                )
              })}
            </div>
          </div>

        </div>

        {/* Right column: equipment */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-text-3">Equipo</p>
            <button className="btn btn--ghost btn--sm" onClick={() => setBagOpen(true)}>
              <Backpack size={13} strokeWidth={2} />
              Mochila {bag.length}/{bagLimit}
            </button>
          </div>

          {/* Armadura */}
          <div className="flex flex-col gap-2.5 py-2.5 px-[10px] pl-3 border-l-2 rounded-r-lg" style={{ '--eq-color': '#3b82f6', borderLeftColor: '#3b82f6', background: 'color-mix(in srgb, #3b82f6 4%, transparent)' }}>
            <div className="flex items-center gap-[5px]">
              <Shield size={11} strokeWidth={2.5} style={{ color: '#3b82f6', opacity: 0.85 }} />
              <span className="text-[13px] font-bold uppercase tracking-[0.1em]" style={{ color: '#3b82f6' }}>Armadura</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-[5px]">
              {['helmet', 'chest', 'arms', 'legs'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onSlotClick={s => setSlotPicker(s)} onRepair={handleRepair} loading={mutationPending} isOccupied={isOccupied} />
              ))}
            </div>
          </div>

          {/* Armas */}
          <div className="flex flex-col gap-2.5 py-2.5 px-[10px] pl-3 border-l-2 rounded-r-lg" style={{ '--eq-color': '#d97706', borderLeftColor: '#d97706', background: 'color-mix(in srgb, #d97706 4%, transparent)' }}>
            <div className="flex items-center gap-[5px]">
              <Sword size={11} strokeWidth={2.5} style={{ color: '#d97706', opacity: 0.85 }} />
              <span className="text-[13px] font-bold uppercase tracking-[0.1em]" style={{ color: '#d97706' }}>Armas</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-[5px]">
              {['main_hand', 'off_hand'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onSlotClick={s => setSlotPicker(s)} onRepair={handleRepair} loading={mutationPending} isOccupied={isOccupied} />
              ))}
            </div>
          </div>

          {/* Complemento */}
          <div className="flex flex-col gap-2.5 py-2.5 px-[10px] pl-3 border-l-2 rounded-r-lg" style={{ '--eq-color': '#7c3aed', borderLeftColor: '#7c3aed', background: 'color-mix(in srgb, #7c3aed 4%, transparent)' }}>
            <div className="flex items-center gap-[5px]">
              <Gem size={11} strokeWidth={2.5} style={{ color: '#7c3aed', opacity: 0.85 }} />
              <span className="text-[13px] font-bold uppercase tracking-[0.1em]" style={{ color: '#7c3aed' }}>Complemento</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-[5px]">
              {['accessory', 'accessory_2'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onSlotClick={s => setSlotPicker(s)} onRepair={handleRepair} loading={mutationPending} isOccupied={isOccupied} />
              ))}
            </div>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {slotPicker && (
          <SlotPickerSheet
            slot={slotPicker}
            equippedItem={equipped[slotPicker]}
            bagItems={bag}
            onEquip={(id) => { handleEquip(id); setSlotPicker(null) }}
            onUnequip={(id) => { handleUnequip(id); setSlotPicker(null) }}
            onRepair={handleRepair}
            loading={mutationPending}
            isOccupied={isOccupied}
            onClose={() => setSlotPicker(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cardPickerOpen && (
          <CardPickerSheet
            currentCard={cardPickerOpen.currentCard ?? null}
            cards={cards ?? []}
            hero={hero}
            cardSlots={cardSlotCount}
            onEquip={(id) => { handleCardEquip(id); setCardPickerOpen(false) }}
            onUnequip={(id) => { handleCardUnequip(id); setCardPickerOpen(false) }}
            onFuse={handleCardFuse}
            loading={mutationPending}
            isOccupied={isOccupied}
            onClose={() => setCardPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bagOpen && (
          <BagModal
            bag={bag}
            bagLimit={bagLimit}
            onDiscard={handleDiscard}
            loading={mutationPending}
            onClose={() => setBagOpen(false)}
            isOccupied={isOccupied}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cardModalOpen && (
          <CardModal
            cards={cards ?? []}
            hero={hero}
            cardSlots={cardSlotCount}
            onEquip={handleCardEquip}
            onUnequip={handleCardUnequip}
            onFuse={handleCardFuse}
            loading={mutationPending}
            onClose={() => setCardModalOpen(false)}
            isOccupied={isOccupied}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal && (
          <ConfirmModal
            title={confirmModal.title}
            body={confirmModal.body}
            confirmLabel={confirmModal.confirmLabel}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default Hero
