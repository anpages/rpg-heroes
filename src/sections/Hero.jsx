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
import {
  Sword, Shield, Heart, Dumbbell, Wind, Brain, CircleDot,
  Crown, Shirt, Hand, Move, Gem, Trash2, ArrowUpDown, Backpack, X,
  BookOpen, Zap, FlameKindling, Wrench, Plus,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './Hero.css'

const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

function sheetVariants() {
  return isMobile()
    ? { initial: { y: '100vh' }, animate: { y: 0 }, exit: { y: '100vh' } }
    : { initial: { opacity: 0, scale: 0.96, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 4 } }
}

const sheetTransition = { type: 'spring', stiffness: 340, damping: 30 }
const overlayTransition = { duration: 0.18 }

/* ─── Stat radar ──────────────────────────────────────────────────────────────── */

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
    <div className="stat-bars">
      {STAT_BARS.map(({ key, label, Icon, color }) => {
        const total = effective[key] ?? 0
        const baseV = base[key]      ?? 0
        const bonus = total - baseV
        const basePct  = Math.min(100, (baseV  / maxVal) * 100)
        const bonusPct = Math.min(100 - basePct, (bonus / maxVal) * 100)

        return (
          <div key={key} className="stat-bar-row">
            <div className="stat-bar-icon" style={{ color }}>
              <Icon size={13} strokeWidth={2} />
            </div>
            <span className="stat-bar-label">{label}</span>
            <div className="stat-bar-track">
              <div className="stat-bar-base"  style={{ width: `${basePct}%`,  background: color, opacity: 0.55 }} />
              <div className="stat-bar-bonus" style={{ width: `${bonusPct}%`, background: color }} />
            </div>
            <span className="stat-bar-value">{total}</span>
            {bonus > 0 && (
              <span className="stat-bar-bonus-label" style={{ color }}>+{bonus}</span>
            )}
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
  helmet:    { label: 'Casco',           icon: Crown  },
  chest:     { label: 'Torso',           icon: Shirt  },
  arms:      { label: 'Brazos',          icon: Hand   },
  legs:      { label: 'Piernas',         icon: Move   },
  main_hand: { label: 'Arma Principal',  icon: Sword  },
  off_hand:  { label: 'Mano Secundaria', icon: Shield },
  accessory:   { label: 'Complemento',   icon: Gem    },
  accessory_2: { label: 'Complemento 2', icon: Gem    },
}

const RARITY_META = {
  common:    { label: 'Común',      color: '#6b7280' },
  uncommon:  { label: 'Poco Común', color: '#16a34a' },
  rare:      { label: 'Raro',       color: '#2563eb' },
  epic:      { label: 'Épico',      color: '#7c3aed' },
  legendary: { label: 'Legendario', color: '#d97706' },
}

const EQUIPMENT_SLOTS = ['helmet', 'chest', 'arms', 'legs', 'main_hand', 'off_hand', 'accessory', 'accessory_2']
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
  const costs = REPAIR_COST_TABLE[catalog.rarity] ?? REPAIR_COST_TABLE.common
  return {
    gold: Math.ceil(missing * costs.gold),
    mana: Math.ceil(missing * costs.mana),
  }
}

/* ─── Shared sub-components ───────────────────────────────────────────────────── */

function XpBar({ level, experience }) {
  const needed = level * 150
  const pct = Math.min(100, Math.round((experience / needed) * 100))
  return (
    <div className="xp-bar-wrap">
      <div className="xp-bar-labels">
        <span>Nivel {level}</span>
        <span>{experience} / {needed} XP</span>
      </div>
      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StatRow({ icon: Icon, label, value, color, bonus, equipBonus = 0, cardBonus = 0 }) {
  const [open, setOpen] = useState(false)
  const hasBonus = bonus > 0

  return (
    <div className="stat-row-wrap">
      <div
        className={`stat-row ${hasBonus ? 'stat-row--tappable' : ''}`}
        onClick={() => hasBonus && setOpen(o => !o)}
      >
        <div className="stat-icon" style={{ color }}>
          <Icon size={16} strokeWidth={1.8} />
        </div>
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        <span className="stat-bonus">{hasBonus ? `+${bonus}` : ''}</span>
      </div>
      {open && hasBonus && (
        <div className="stat-breakdown">
          {equipBonus > 0 && <span className="stat-breakdown-item">⚔ Equipo +{equipBonus}</span>}
          {cardBonus  > 0 && <span className="stat-breakdown-item">✦ Cartas +{cardBonus}</span>}
        </div>
      )}
    </div>
  )
}

function HpBar({ current, max, recovering = false }) {
  const pct = Math.min(100, Math.round((current / max) * 100))
  const color = recovering ? '#0369a1' : pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  const lowHp = pct < 20
  return (
    <div className="hp-bar-wrap">
      <div className="hp-bar-labels">
        <span className="hp-label"><Heart size={13} strokeWidth={2} color={color} /> HP</span>
        <span className="hp-value" style={{ color }}>{current} / {max}</span>
      </div>
      <div className={`hp-track ${recovering ? 'hp-track--recovering' : ''}`}>
        <div className="hp-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {lowHp && !recovering && (
        <p className="hp-low-warning">HP bajo — el héroe no puede combatir ni explorar. ¡Descansa!</p>
      )}
    </div>
  )
}

function DurabilityBar({ current, max }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  const color = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  return (
    <div className="inv-dur-track">
      <div className="inv-dur-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

/* ─── Confirm modal ───────────────────────────────────────────────────────────── */

function ConfirmModal({ title, body, confirmLabel = 'Confirmar', onConfirm, onCancel }) {
  return createPortal(
    <motion.div className="confirm-overlay" onClick={onCancel}
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
    >
      <motion.div className="confirm-modal" onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6 }}
        transition={sheetTransition}
      >
        <p className="confirm-title">{title}</p>
        {body && <p className="confirm-body">{body}</p>}
        <div className="confirm-actions">
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--primary btn--sm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Equipment slot (panel lateral) ─────────────────────────────────────────── */

function EquipmentSlot({ slot, item, onSlotClick, onRepair, loading, isOccupied }) {
  const meta = SLOT_META[slot]
  const Icon = meta.icon
  const catalog = item?.item_catalog
  const rarity = catalog ? RARITY_META[catalog.rarity] : null
  const durPct = item ? Math.round((item.current_durability / catalog.max_durability) * 100) : 100

  const isCritical = item && durPct > 0 && durPct <= 25
  const isBroken   = item && durPct === 0
  const needsRepair = item && durPct < 100

  return (
    <button
      className={`eq-slot eq-slot--interactive ${item ? 'eq-slot--filled' : ''} ${isCritical ? 'eq-slot--critical' : ''} ${isBroken ? 'eq-slot--broken' : ''}`}
      onClick={() => onSlotClick(slot)}
    >
      <div className="eq-slot-header">
        <Icon size={13} strokeWidth={1.8} className="eq-slot-icon" />
        <span className="eq-slot-label">{meta.label}</span>
        {isBroken   && <span className="eq-slot-status eq-slot-status--broken">Roto</span>}
        {isCritical && <span className="eq-slot-status eq-slot-status--critical">Crítico</span>}
      </div>
      {item ? (
        <>
          <p className="eq-item-name" style={{ color: rarity?.color }}>{catalog.name}</p>
          <StatsList catalog={catalog} />
          <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
          {needsRepair && (
            <div className="eq-slot-actions">
              <button className="btn btn--ghost btn--icon eq-repair-btn" onClick={e => { e.stopPropagation(); onRepair(item) }} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : 'Reparar'}>
                <Wrench size={13} strokeWidth={2} />
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="eq-slot-empty">Vacío</p>
      )}
    </button>
  )
}

/* ─── Bag item (modal) ────────────────────────────────────────────────────────── */

function StatsList({ catalog }) {
  const stats = [
    { key: 'attack_bonus',       label: 'Atq' },
    { key: 'defense_bonus',      label: 'Def' },
    { key: 'hp_bonus',           label: 'HP'  },
    { key: 'strength_bonus',     label: 'Fue' },
    { key: 'agility_bonus',      label: 'Agi' },
    { key: 'intelligence_bonus', label: 'Int' },
  ].filter(s => catalog[s.key] > 0)

  if (!stats.length) return <span className="inv-no-stats">Sin bonificaciones</span>
  return (
    <div className="inv-stats">
      {stats.map(s => (
        <span key={s.key} className="inv-stat">+{catalog[s.key]} {s.label}</span>
      ))}
    </div>
  )
}

function BagItem({ item, onDiscard, loading, isOccupied }) {
  const catalog = item.item_catalog
  const rarity = RARITY_META[catalog.rarity]
  const slotMeta = SLOT_META[catalog.slot]

  return (
    <div className="bag-item">
      <div className="bag-item-header">
        <span className="bag-item-name" style={{ color: rarity.color }}>{catalog.name}</span>
        <span className="bag-item-tier">T{catalog.tier}</span>
      </div>
      <div className="bag-item-meta">
        <span className="bag-item-rarity" style={{ color: rarity.color }}>{rarity.label}</span>
        <span className="bag-item-slot">{slotMeta.label}</span>
        {catalog.is_two_handed && <span className="bag-item-2h">2 manos</span>}
      </div>
      <StatsList catalog={catalog} />
      <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
      <div className="bag-item-actions">
        <button className="btn btn--danger btn--icon" onClick={() => onDiscard(item)} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : undefined}>
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

/* ─── Bag modal ───────────────────────────────────────────────────────────────── */

function BagModal({ bag, bagLimit, onDiscard, loading, error, onClose, isOccupied }) {
  const sv = sheetVariants()
  return createPortal(
    <motion.div className="bag-modal-overlay" onClick={onClose}
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
    >
      <motion.div className="bag-modal-panel" onClick={e => e.stopPropagation()}
        variants={sv} initial="initial" animate="animate" exit="exit"
        transition={sheetTransition}
      >
        <div className="bag-modal-header">
          <div className="bag-modal-title-wrap">
            <Backpack size={18} strokeWidth={1.8} />
            <span className="bag-modal-title">Mochila</span>
            <span className="bag-modal-count">{bag.length} / {bagLimit}</span>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {error && <p className="inv-error">{error}</p>}

        {isOccupied && (
          <p className="inv-locked-notice">El héroe está en expedición — el equipo no se puede modificar.</p>
        )}
        {bag.length === 0 ? (
          <p className="inv-bag-empty">La mochila está vacía. Explora mazmorras para conseguir equipo.</p>
        ) : (
          <div className="bag-grid">
            {bag.map(item => (
              <BagItem
                key={item.id}
                item={item}
                onDiscard={onDiscard}
                loading={loading}
                isOccupied={isOccupied}
              />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Card constants ──────────────────────────────────────────────────────────── */

const CATEGORY_META = {
  attack:       { label: 'Ataque',  short: 'Atq', color: '#d97706', icon: Sword    },
  defense:      { label: 'Defensa', short: 'Def', color: '#475569', icon: Shield   },
  strength:     { label: 'Fuerza',  short: 'Fue', color: '#dc2626', icon: Dumbbell },
  agility:      { label: 'Agilidad',short: 'Agi', color: '#0369a1', icon: Wind     },
  intelligence: { label: 'Int.',    short: 'Int', color: '#7c3aed', icon: Brain    },
}

/* ─── Card budget bar ─────────────────────────────────────────────────────────── */

function CardBudgetBar({ category, used, total }) {
  const meta = CATEGORY_META[category]
  const Icon = meta.icon
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const over = used > total
  const color = over ? '#dc2626' : meta.color
  return (
    <div className="card-budget" title={`${meta.label}: ${used}/${total}`}>
      <div className="card-budget-row">
        <span className="card-budget-icon" style={{ color }}><Icon size={11} strokeWidth={2.2} /></span>
        <span className="card-budget-short" style={{ color }}>{meta.short}</span>
        <div className="card-budget-track">
          <div className="card-budget-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className={`card-budget-nums ${over ? 'card-budget-nums--over' : ''}`}>{used}/{total}</span>
      </div>
    </div>
  )
}

/* ─── Equipped card chip ──────────────────────────────────────────────────────── */

function CardChip({ card, onClick, loading, isOccupied }) {
  const sc = card.skill_cards
  const meta = CATEGORY_META[sc.category]
  return (
    <button
      className="card-chip card-chip--interactive"
      style={{ '--card-color': meta.color }}
      onClick={onClick}
      disabled={loading}
      title={isOccupied ? 'El héroe está en expedición' : 'Gestionar carta'}
    >
      <div className="card-chip-top">
        <span className="card-chip-name">{sc.name}</span>
        <span className="card-chip-rank">R{card.rank}</span>
      </div>
      <div className="card-chip-meta">
        <span className="card-chip-category" style={{ color: meta.color }}>{meta.label}</span>
        <span className="card-chip-cost">{sc.base_cost * card.rank} pts</span>
      </div>
    </button>
  )
}

/* ─── Card collection modal ───────────────────────────────────────────────────── */

function CardItem({ card, canEquip, canFuseWith, onEquip, onUnequip, onFuse, loading, isOccupied }) {
  const sc = card.skill_cards
  const meta = CATEGORY_META[sc.category]
  const Icon = meta.icon
  const effects = [
    sc.attack_bonus       > 0 && `+${sc.attack_bonus * card.rank} Atq`,
    sc.defense_bonus      > 0 && `+${sc.defense_bonus * card.rank} Def`,
    sc.hp_bonus           > 0 && `+${sc.hp_bonus * card.rank} HP`,
    sc.strength_bonus     > 0 && `+${sc.strength_bonus * card.rank} Fue`,
    sc.agility_bonus      > 0 && `+${sc.agility_bonus * card.rank} Agi`,
    sc.intelligence_bonus > 0 && `+${sc.intelligence_bonus * card.rank} Int`,
  ].filter(Boolean)

  return (
    <div className={`card-item ${card.equipped ? 'card-item--equipped' : ''}`} style={{ '--card-color': meta.color }}>
      <div className="card-item-header">
        <span className="card-item-name">{sc.name}</span>
        <div className="card-item-badges">
          <span className="card-item-rank">R{card.rank}</span>
          {canFuseWith && <span className="card-item-fuseable"><FlameKindling size={10} strokeWidth={2} /></span>}
        </div>
      </div>
      <div className="card-item-meta">
        <span className="card-item-category" style={{ color: meta.color }}>
          <Icon size={10} strokeWidth={2} /> {meta.label}
        </span>
        <span className="card-item-cost">{sc.base_cost * card.rank} pts · {sc.rarity}</span>
      </div>
      {sc.description && <p className="card-item-desc">{sc.description}</p>}
      <div className="card-item-effects">
        {effects.map(e => <span key={e} className="card-item-effect">{e}</span>)}
      </div>
      <div className="card-item-actions">
        {canFuseWith && !card.equipped && (
          <button className="btn btn--warning btn--sm" onClick={() => onFuse(card.id, canFuseWith.id)} disabled={loading || isOccupied}>
            <FlameKindling size={12} strokeWidth={2} /> Fusionar · {sc.base_mana_fuse * Math.pow(2, card.rank - 1)} maná
          </button>
        )}
        {card.equipped ? (
          <button className="btn btn--ghost btn--sm" onClick={() => onUnequip(card.id)} disabled={loading || isOccupied}>Desequipar</button>
        ) : (
          <button className="btn btn--primary btn--sm" onClick={() => onEquip(card.id)} disabled={loading || !canEquip || isOccupied}>
            Equipar
          </button>
        )}
      </div>
    </div>
  )
}

function CardModal({ cards, hero, cardSlots, onEquip, onUnequip, onFuse, loading, error, onClose, isOccupied }) {
  const equippedCount = cards.filter(c => c.equipped).length


  // Detectar cartas fusionables: misma card_id y mismo rango, sin equipar
  const fuseMap = {}
  cards.filter(c => !c.equipped).forEach(c => {
    const key = `${c.card_id}-${c.rank}`
    if (!fuseMap[key]) fuseMap[key] = []
    fuseMap[key].push(c)
  })

  // Presupuesto usado por categoría (para saber si puede equipar)
  const budgetUsed = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0 }
  cards.filter(c => c.equipped).forEach(c => {
    budgetUsed[c.skill_cards.category] += c.skill_cards.base_cost * c.rank
  })

  const sv = sheetVariants()
  return createPortal(
    <motion.div className="bag-modal-overlay" onClick={onClose}
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
    >
      <motion.div className="bag-modal-panel" onClick={e => e.stopPropagation()}
        variants={sv} initial="initial" animate="animate" exit="exit"
        transition={sheetTransition}
      >
        <div className="bag-modal-header">
          <div className="bag-modal-title-wrap">
            <BookOpen size={18} strokeWidth={1.8} />
            <span className="bag-modal-title">Colección de Cartas</span>
            <span className="bag-modal-count">{cards.length} cartas · {equippedCount}/{cardSlots} equipadas</span>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><X size={18} strokeWidth={2} /></button>
        </div>

        {error && <p className="inv-error">{error}</p>}
        {isOccupied && (
          <p className="inv-locked-notice">El héroe está en expedición — las cartas no se pueden modificar.</p>
        )}

        {cards.length === 0 ? (
          <p className="inv-bag-empty">Sin cartas. Explora mazmorras mágicas o antiguas para conseguirlas.</p>
        ) : (
          <div className="bag-grid">
            {cards.map(card => {
              const key = `${card.card_id}-${card.rank}`
              const fusePair = fuseMap[key]?.find(c => c.id !== card.id)
              const cat = card.skill_cards.category
              const cost = card.skill_cards.base_cost * card.rank
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
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Slot picker sheet ───────────────────────────────────────────────────────── */

function SlotPickerSheet({ slot, equippedItem, bagItems, onEquip, onUnequip, onRepair, loading, isOccupied, onClose }) {
  const meta = SLOT_META[slot]
  const Icon = meta.icon
  const sv = sheetVariants()

  const compatible = bagItems.filter(i => i.item_catalog.slot === slot)

  return createPortal(
    <motion.div className="bag-modal-overlay" onClick={onClose}
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
    >
      <motion.div className="bag-modal-panel" onClick={e => e.stopPropagation()}
        variants={sv} initial="initial" animate="animate" exit="exit"
        transition={sheetTransition}
      >
        <div className="bag-modal-header">
          <div className="bag-modal-title-wrap">
            <Icon size={18} strokeWidth={1.8} />
            <span className="bag-modal-title">{meta.label}</span>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {isOccupied && (
          <p className="inv-locked-notice">El héroe está en expedición — el equipo no se puede modificar.</p>
        )}

        {equippedItem && (() => {
          const catalog = equippedItem.item_catalog
          const rarity = RARITY_META[catalog.rarity]
          const durPct = Math.round((equippedItem.current_durability / catalog.max_durability) * 100)
          const needsRepair = durPct < 100
          return (
            <div className="slot-picker-current">
              <div className="slot-picker-current-header">
                <div className="slot-picker-current-info">
                  <p className="eq-item-name" style={{ color: rarity?.color }}>{catalog.name}</p>
                  <StatsList catalog={catalog} />
                  <DurabilityBar current={equippedItem.current_durability} max={catalog.max_durability} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {needsRepair && (
                    <button className="btn btn--ghost btn--icon eq-repair-btn" onClick={() => onRepair(equippedItem)} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : 'Reparar'}>
                      <Wrench size={13} strokeWidth={2} />
                    </button>
                  )}
                  <button className="btn btn--ghost btn--sm" onClick={() => onUnequip(equippedItem.id)} disabled={loading || isOccupied}>
                    Desequipar
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        <p className="slot-picker-section-label">Disponible en mochila</p>

        {compatible.length === 0 ? (
          <p className="inv-bag-empty">No hay ítems compatibles en la mochila.</p>
        ) : (
          <div className="slot-picker-list">
            {compatible.map(item => {
              const catalog = item.item_catalog
              const rarity = RARITY_META[catalog.rarity]
              const durPct = Math.round((item.current_durability / catalog.max_durability) * 100)
              const disabled = loading || durPct === 0 || isOccupied
              return (
                <button
                  key={item.id}
                  className={`slot-picker-item${disabled ? ' slot-picker-item--disabled' : ''}`}
                  onClick={() => onEquip(item.id)}
                  disabled={disabled}
                  title={isOccupied ? 'El héroe está en expedición' : durPct === 0 ? 'Repara el ítem antes de equiparlo' : ''}
                >
                  <div className="slot-picker-item-header">
                    <span className="bag-item-name" style={{ color: rarity.color }}>{catalog.name}</span>
                    <span className="bag-item-tier">T{catalog.tier}</span>
                  </div>
                  <div className="bag-item-meta">
                    <span className="bag-item-rarity" style={{ color: rarity.color }}>{rarity.label}</span>
                    {catalog.is_two_handed && <span className="bag-item-2h">2 manos</span>}
                  </div>
                  <StatsList catalog={catalog} />
                  <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
                </button>
              )
            })}
          </div>
        )}
      </motion.div>
    </motion.div>,
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

  const sv = sheetVariants()
  const unequipped = cards.filter(c => !c.equipped)

  return createPortal(
    <motion.div className="bag-modal-overlay" onClick={onClose}
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
    >
      <motion.div className="bag-modal-panel" onClick={e => e.stopPropagation()}
        variants={sv} initial="initial" animate="animate" exit="exit"
        transition={sheetTransition}
      >
        <div className="bag-modal-header">
          <div className="bag-modal-title-wrap">
            <BookOpen size={18} strokeWidth={1.8} />
            <span className="bag-modal-title">Cartas de habilidad</span>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {error && <p className="inv-error">{error}</p>}
        {isOccupied && (
          <p className="inv-locked-notice">El héroe está en expedición — las cartas no se pueden modificar.</p>
        )}

        {currentCard && (() => {
          const sc = currentCard.skill_cards
          const meta = CATEGORY_META[sc.category]
          return (
            <div className="slot-picker-current">
              <div className="slot-picker-current-header">
                <div className="slot-picker-current-info">
                  <p className="card-item-name" style={{ color: meta.color }}>{sc.name}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span className="card-item-rank" style={{ '--card-color': meta.color }}>R{currentCard.rank}</span>
                    <span className="card-item-cost">{sc.base_cost * currentCard.rank} pts</span>
                  </div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => onUnequip(currentCard.id)} disabled={loading || isOccupied}>
                  Desequipar
                </button>
              </div>
            </div>
          )
        })()}

        <p className="slot-picker-section-label">Disponible</p>

        {unequipped.length === 0 ? (
          <p className="inv-bag-empty">No hay cartas disponibles para equipar.</p>
        ) : (
          <div className="bag-grid">
            {unequipped.map(card => {
              const key = `${card.card_id}-${card.rank}`
              const fusePair = fuseMap[key]?.find(c => c.id !== card.id)
              const cat = card.skill_cards.category
              const cost = card.skill_cards.base_cost * card.rank
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
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Main component ──────────────────────────────────────────────────────────── */

// HP interpolation — 100%/hr idle (full recovery from 0 in ~1h)
function interpolateHpClient(hero, nowMs, effectiveMaxHp) {
  if (!hero) return 0
  const maxHp      = effectiveMaxHp ?? hero.max_hp
  const lastMs     = hero.hp_last_updated_at ? new Date(hero.hp_last_updated_at).getTime() : nowMs
  const elapsedMin = Math.max(0, (nowMs - lastMs) / 60000)
  const regenPerMin = hero.status === 'exploring' ? 0 : (100 / 60)
  const regen      = elapsedMin * regenPerMin * hero.max_hp / 100
  return Math.min(maxHp, Math.floor(hero.current_hp + regen))
}

function Hero() {
  const userId      = useAppStore(s => s.userId)
  const heroId      = useHeroId()
  const queryClient = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { items, loading: invLoading } = useInventory(hero?.id)
  const { cards, loading: cardsLoading } = useHeroCards(hero?.id)
  const { buildings } = useBuildings(userId)
  const [bagOpen, setBagOpen] = useState(false)
  const [slotPicker, setSlotPicker] = useState(null)
  const [cardPickerOpen, setCardPickerOpen] = useState(false)
  const [cardModalOpen, setCardModalOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [workshopLevel, setWorkshopLevel] = useState(1)
  const [libraryLevel, setLibraryLevel] = useState(1)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  // Mutación para items (equip/unequip/repair/dismantle)
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
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.inventory(hero?.id), context.previous)
      }
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(hero?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
  })

  // Mutación para cartas (equip/unequip/fuse)
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
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.heroCards(hero?.id), context.previous)
      }
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroCards(hero?.id) })
    },
  })

  const mutationPending = itemMutation.isPending || cardMutation.isPending

  // Tick cada 30s para actualizar HP interpolado
  useEffect(() => {
    const id = setInterval(forceUpdate, 30000)
    return () => clearInterval(id)
  }, [])

  // Derivar workshop/library level de la caché de buildings
  useEffect(() => {
    if (!buildings) return
    buildings.forEach(b => {
      if (b.type === 'workshop') setWorkshopLevel(b.level)
      if (b.type === 'library')  setLibraryLevel(b.level)
    })
  }, [buildings])

  if (heroLoading || invLoading || cardsLoading) return null
  if (!hero) return (
    <div className="hero-loading">
      {heroId ? 'No se encontró el héroe.' : 'Recluta tu primer héroe para comenzar.'}
    </div>
  )

  const cls = hero.classes
  const status = STATUS_META[hero.status] ?? STATUS_META.idle
  const isOccupied = hero.status === 'exploring'

  const equipped = EQUIPMENT_SLOTS.reduce((acc, slot) => {
    acc[slot] = items?.find(i => i.equipped_slot === slot) ?? null
    return acc
  }, {})

  // Bonos del equipo equipado (durabilidad > 0)
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

  // Bonos de cartas equipadas (efectos × rango)
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

  // Presupuesto de cartas por categoría (usa stats BASE del héroe, no efectivas)
  const cardBudgetUsed = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0 }
  ;(cards ?? []).filter(c => c.equipped).forEach(c => {
    cardBudgetUsed[c.skill_cards.category] += c.skill_cards.base_cost * c.rank
  })
  const cardSlotCount = 1 + libraryLevel * 2  // nivel 1=3, nivel 2=5, nivel 3=7...

  const hpNow = interpolateHpClient(hero, Date.now(), effective.max_hp)

  const bag = items?.filter(i => !i.equipped_slot) ?? []
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
      // Las dos cartas se consumen; el resultado nuevo llega con el refetch (onSettled)
      optimisticUpdate: cards?.filter(c => c.id !== id1 && c.id !== id2),
    })
  }


  return (
    <motion.div key="hero-content" className="hero-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
      <div className="hero-layout">

        {/* Columna izquierda: ficha + cartas */}
        <div className="hero-left-col">

        <div className="hero-card">
          <div className="hero-card-header">
            <div className="hero-avatar">
              <Sword size={32} strokeWidth={1.5} color={cls?.color} />
            </div>
            <div className="hero-identity">
              <h3 className="hero-name">{hero.name}</h3>
              <div className="hero-badges">
                <span className="hero-class-badge" style={{ '--cls-color': cls?.color }}>
                  {cls?.name}
                </span>
                <span className="hero-status-badge" style={{ color: status.color }}>
                  <CircleDot size={10} strokeWidth={2.5} />
                  {status.label}
                </span>
              </div>
            </div>
          </div>

          <XpBar level={hero.level} experience={hero.experience} />
          <HpBar
            current={hpNow ?? hero.current_hp}
            max={effective.max_hp}
            recovering={hero.status === 'idle'}
          />

          <StatBars
            effective={{ attack: effective.attack, defense: effective.defense, strength: effective.strength, agility: effective.agility, intelligence: effective.intelligence }}
            base={{ attack: hero.attack, defense: hero.defense, strength: hero.strength, agility: hero.agility, intelligence: hero.intelligence }}
          />
        </div>

        {/* Panel de cartas */}
        <div className="hero-cards-section">
          <div className="hero-cards-header">
            <p className="hero-cards-title">
              <BookOpen size={14} strokeWidth={2} />
              Cartas de Habilidad
            </p>
            <button className="btn btn--ghost btn--sm" onClick={() => setCardModalOpen(true)}>
              <Zap size={13} strokeWidth={2} />
              Colección {(cards ?? []).length}
            </button>
          </div>

          <div className="card-budgets">
            {['attack', 'defense', 'strength', 'agility', 'intelligence'].map(cat => (
              <CardBudgetBar
                key={cat}
                category={cat}
                used={cardBudgetUsed[cat]}
                total={hero[cat]}
              />
            ))}
          </div>

          <div className="equipped-cards-grid">
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
                  className="card-slot-add-btn"
                  onClick={() => setCardPickerOpen({ currentCard: null })}
                >
                  <Plus size={13} strokeWidth={2} />
                  Equipar carta
                </button>
              )
            })}
          </div>
        </div>

        </div>{/* /hero-left-col */}

        {/* Panel de equipo */}
        <div className="hero-equipment-panel">
          <div className="hero-eq-header">
            <p className="hero-eq-title">Equipo</p>
            <button className="btn btn--ghost btn--sm" onClick={() => setBagOpen(true)}>
              <Backpack size={13} strokeWidth={2} />
              Mochila {bag.length}/{bagLimit}
            </button>
          </div>



          {/* Armadura */}
          <div className="eq-group eq-group--armor">
            <div className="eq-group-header">
              <Shield size={11} strokeWidth={2.5} className="eq-group-icon" />
              <span className="eq-group-name">Armadura</span>
            </div>
            <div className="eq-slots-grid">
              {['helmet', 'chest', 'arms', 'legs'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onSlotClick={(slot) => setSlotPicker(slot)} onRepair={handleRepair} loading={mutationPending} isOccupied={isOccupied} />
              ))}
            </div>
          </div>

          {/* Armas */}
          <div className="eq-group eq-group--weapons">
            <div className="eq-group-header">
              <Sword size={11} strokeWidth={2.5} className="eq-group-icon" />
              <span className="eq-group-name">Armas</span>
            </div>
            <div className="eq-slots-grid eq-slots-grid--2">
              {['main_hand', 'off_hand'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onSlotClick={(slot) => setSlotPicker(slot)} onRepair={handleRepair} loading={mutationPending} isOccupied={isOccupied} />
              ))}
            </div>
          </div>

          {/* Complemento */}
          <div className="eq-group eq-group--accessory">
            <div className="eq-group-header">
              <Gem size={11} strokeWidth={2.5} className="eq-group-icon" />
              <span className="eq-group-name">Complemento</span>
            </div>
            <div className="eq-slots-grid eq-slots-grid--2">
              {['accessory', 'accessory_2'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onSlotClick={(slot) => setSlotPicker(slot)} onRepair={handleRepair} loading={mutationPending} isOccupied={isOccupied} />
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
