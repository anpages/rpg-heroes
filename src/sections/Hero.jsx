import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useHeroCards } from '../hooks/useHeroCards'
import {
  Sword, Shield, Heart, Dumbbell, Wind, Brain, CircleDot,
  Crown, Shirt, Hand, Move, Gem, Trash2, ArrowUpDown, Backpack, X,
  BookOpen, Zap, FlameKindling, Wrench, Moon, Sun,
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
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { opacity: 0, scale: 0.96, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 4 } }
}

const sheetTransition = { type: 'spring', stiffness: 340, damping: 30 }
const overlayTransition = { duration: 0.18 }

/* ─── Stat radar ──────────────────────────────────────────────────────────────── */

const RADAR_STATS = [
  { key: 'attack',       label: 'Ataque',   angle: -90, anchor: 'middle', dy: -8  },
  { key: 'strength',     label: 'Fuerza',   angle: -18, anchor: 'start',  dy: -4  },
  { key: 'intelligence', label: 'Int.',      angle:  54, anchor: 'start',  dy:  12 },
  { key: 'agility',      label: 'Agilidad', angle: 126, anchor: 'end',    dy:  12 },
  { key: 'defense',      label: 'Defensa',  angle: 198, anchor: 'end',    dy: -4  },
]

function StatRadar({ effective, base, classColor }) {
  const CX = 110, CY = 112, R = 72
  const color = classColor ?? '#2563eb'

  const effVals  = RADAR_STATS.map(s => effective[s.key]  ?? 0)
  const baseVals = RADAR_STATS.map(s => base[s.key]       ?? 0)
  const maxVal   = Math.max(20, ...effVals) * 1.35

  function toXY(angle, val) {
    const rad = (angle * Math.PI) / 180
    const r   = (val / maxVal) * R
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
  }
  function toXYr(angle, r) {
    const rad = (angle * Math.PI) / 180
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
  }
  function pts(vals) {
    return RADAR_STATS.map((s, i) => toXY(s.angle, vals[i]).join(',')).join(' ')
  }

  return (
    <svg viewBox="0 0 220 224" className="stat-radar">
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map(g => (
        <polygon key={g}
          points={RADAR_STATS.map(s => toXYr(s.angle, R * g).join(',')).join(' ')}
          fill="none" stroke="var(--border)"
          strokeWidth={g === 1 ? 1.5 : 0.8}
          opacity={g === 1 ? 0.7 : 0.3}
        />
      ))}
      {/* Axes */}
      {RADAR_STATS.map(s => {
        const [x2, y2] = toXYr(s.angle, R)
        return <line key={s.key} x1={CX} y1={CY} x2={x2} y2={y2} stroke="var(--border)" strokeWidth="0.8" opacity="0.4" />
      })}
      {/* Base polygon */}
      <polygon points={pts(baseVals)}
        fill={color} fillOpacity="0.08"
        stroke={color} strokeWidth="1.2" strokeOpacity="0.35"
        strokeDasharray="4 3" strokeLinejoin="round"
      />
      {/* Effective polygon */}
      <polygon points={pts(effVals)}
        fill={color} fillOpacity="0.22"
        stroke={color} strokeWidth="2.2" strokeLinejoin="round"
      />
      {/* Vertex dots */}
      {RADAR_STATS.map((s, i) => {
        const [x, y] = toXY(s.angle, effVals[i])
        return <circle key={s.key} cx={x} cy={y} r="4" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
      })}
      {/* Labels */}
      {RADAR_STATS.map((s, i) => {
        const [lx, ly] = toXYr(s.angle, R + 24)
        const bonus = effVals[i] - baseVals[i]
        return (
          <g key={s.key}>
            <text x={lx} y={ly + s.dy} textAnchor={s.anchor}
              fontSize="8" fill="var(--text-3)"
              fontFamily="Outfit,sans-serif" fontWeight="600" letterSpacing="0.07em">
              {s.label.toUpperCase()}
            </text>
            <text x={lx} y={ly + s.dy + 13} textAnchor={s.anchor}
              fontSize="14" fill="var(--text)"
              fontFamily="Outfit,sans-serif" fontWeight="700">
              {effVals[i]}
              {bonus > 0 && (
                <tspan fontSize="10" fill={color} fontWeight="700"> +{bonus}</tspan>
              )}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ─── Hero status ─────────────────────────────────────────────────────────────── */

const STATUS_META = {
  idle:      { label: 'En reposo',   color: '#16a34a' },
  exploring: { label: 'Explorando',  color: '#d97706' },
  resting:   { label: 'Recuperando', color: '#60a5fa' },
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
  return (
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
    </motion.div>
  )
}

/* ─── Equipment slot (panel lateral) ─────────────────────────────────────────── */

function EquipmentSlot({ slot, item, onUnequip, onRepair, loading, isOccupied }) {
  const meta = SLOT_META[slot]
  const Icon = meta.icon
  const catalog = item?.item_catalog
  const rarity = catalog ? RARITY_META[catalog.rarity] : null
  const durPct = item ? Math.round((item.current_durability / catalog.max_durability) * 100) : 100

  const isCritical = item && durPct > 0 && durPct <= 25
  const isBroken   = item && durPct === 0
  const needsRepair = item && durPct < 100

  return (
    <div className={`eq-slot ${item ? 'eq-slot--filled' : ''} ${isCritical ? 'eq-slot--critical' : ''} ${isBroken ? 'eq-slot--broken' : ''}`}>
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
          <div className="eq-slot-actions">
            {needsRepair && (
              <button className="btn btn--ghost btn--icon eq-repair-btn" onClick={() => onRepair(item)} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : 'Reparar'}>
                <Wrench size={13} strokeWidth={2} />
              </button>
            )}
            <button className="btn btn--ghost btn--sm" onClick={() => onUnequip(item.id)} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : undefined}>
              Desequipar
            </button>
          </div>
        </>
      ) : (
        <p className="eq-slot-empty">Vacío</p>
      )}
    </div>
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

function BagItem({ item, onEquip, onDiscard, loading, isOccupied }) {
  const catalog = item.item_catalog
  const rarity = RARITY_META[catalog.rarity]
  const slotMeta = SLOT_META[catalog.slot]
  const durPct = Math.round((item.current_durability / catalog.max_durability) * 100)

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
        <button
          className="btn btn--primary btn--sm"
          onClick={() => onEquip(item.id)}
          disabled={loading || durPct === 0 || isOccupied}
          title={isOccupied ? 'El héroe está en expedición' : durPct === 0 ? 'Repara el item antes de equiparlo' : ''}
        >
          <ArrowUpDown size={13} strokeWidth={2} />
          Equipar
        </button>
        <button className="btn btn--danger btn--icon" onClick={() => onDiscard(item)} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : undefined}>
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

/* ─── Bag modal ───────────────────────────────────────────────────────────────── */

function BagModal({ bag, bagLimit, onEquip, onDiscard, loading, error, onClose, isOccupied }) {
  const sv = sheetVariants()
  return (
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
                onEquip={onEquip}
                onDiscard={onDiscard}
                loading={loading}
                isOccupied={isOccupied}
              />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
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

function CardChip({ card, onUnequip, loading, isOccupied }) {
  const sc = card.skill_cards
  const meta = CATEGORY_META[sc.category]
  return (
    <div className="card-chip" style={{ '--card-color': meta.color }}>
      <div className="card-chip-top">
        <span className="card-chip-name">{sc.name}</span>
        <span className="card-chip-rank">R{card.rank}</span>
      </div>
      <div className="card-chip-meta">
        <span className="card-chip-category" style={{ color: meta.color }}>{meta.label}</span>
        <span className="card-chip-cost">{sc.base_cost * card.rank} pts</span>
      </div>
      <button className="btn btn--ghost btn--sm" onClick={() => onUnequip(card.id)} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : undefined}>
        Desequipar
      </button>
    </div>
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
  return (
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
    </motion.div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────────── */

// HP interpolation — 10%/hr idle, 25%/hr resting
function interpolateHpClient(hero, nowMs) {
  if (!hero) return 0
  const lastMs = hero.hp_last_updated_at ? new Date(hero.hp_last_updated_at).getTime() : nowMs
  const elapsedMin = Math.max(0, (nowMs - lastMs) / 60000)
  const regenPctPerMin = hero.status === 'resting' ? 25 / 60 : 10 / 60
  const regen = elapsedMin * regenPctPerMin * hero.max_hp / 100
  return Math.min(hero.max_hp, Math.floor(hero.current_hp + regen))
}

function Hero({ userId, heroId }) {
  const { hero, loading: heroLoading, refetch: refetchHero } = useHero(heroId)
  const { items, loading: invLoading, refetch: refetchInv } = useInventory(hero?.id)
  const { cards, loading: cardsLoading, refetch: refetchCards } = useHeroCards(hero?.id)
  const [actionLoading, setActionLoading] = useState(false)
  const [restLoading, setRestLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bagOpen, setBagOpen] = useState(false)
  const [cardModalOpen, setCardModalOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null) // { title, body, onConfirm }
  const [workshopLevel, setWorkshopLevel] = useState(1)
  const [libraryLevel, setLibraryLevel] = useState(1)
  const [optimisticItems, setOptimisticItems] = useState(null)
  const [hpNow, setHpNow] = useState(null)

  // Recalculate interpolated HP every 30s
  useEffect(() => {
    if (!hero) return
    const update = () => setHpNow(interpolateHpClient(hero, Date.now()))
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [hero])

  useEffect(() => {
    if (!userId) return
    supabase
      .from('buildings')
      .select('type, level')
      .eq('player_id', userId)
      .in('type', ['workshop', 'library'])
      .then(({ data }) => {
        data?.forEach(b => {
          if (b.type === 'workshop') setWorkshopLevel(b.level)
          if (b.type === 'library')  setLibraryLevel(b.level)
        })
      })
  }, [userId])

  // Limpiar optimista cuando llegan datos reales tras el refetch
  useEffect(() => { setOptimisticItems(null) }, [items])

  if (heroLoading || invLoading || cardsLoading) return <div className="hero-loading">Cargando héroe...</div>
  if (!hero) return <div className="hero-loading">No se encontró el héroe.</div>

  const cls = hero.classes
  const status = STATUS_META[hero.status] ?? STATUS_META.idle
  const isOccupied = hero.status === 'exploring'

  const displayItems = optimisticItems ?? items

  const equipped = EQUIPMENT_SLOTS.reduce((acc, slot) => {
    acc[slot] = displayItems?.find(i => i.equipped_slot === slot) ?? null
    return acc
  }, {})

  // Bonos del equipo equipado (durabilidad > 0)
  const equipBonuses = (displayItems ?? [])
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

  const bag = displayItems?.filter(i => !i.equipped_slot) ?? []
  const bagLimit = INVENTORY_BASE_LIMIT + (workshopLevel - 1) * 5

  async function callApi(endpoint, body) {
    setActionLoading(true)
    setError(null)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setActionLoading(false)
    if (!res.ok) { setError(data.error ?? 'Error'); setOptimisticItems(null) }
    else refetchInv()
  }

  function handleEquip(itemId) {
    const current = optimisticItems ?? items
    const item = current?.find(i => i.id === itemId)
    if (item) {
      const targetSlot = item.item_catalog.slot
      setOptimisticItems(current.map(i => {
        if (i.id === itemId) return { ...i, equipped_slot: targetSlot }
        if (i.equipped_slot === targetSlot) return { ...i, equipped_slot: null }
        if (item.item_catalog.is_two_handed && i.equipped_slot === 'off_hand') return { ...i, equipped_slot: null }
        return i
      }))
    }
    callApi('/api/item-equip', { itemId, equip: true })
  }

  function handleUnequip(itemId) {
    const current = optimisticItems ?? items
    setOptimisticItems((current ?? []).map(i => i.id === itemId ? { ...i, equipped_slot: null } : i))
    callApi('/api/item-equip', { itemId, equip: false })
  }
  function handleRepair(item) {
    const cost = estimateRepairCost(item)
    const costText = cost.mana > 0 ? `${cost.gold} oro · ${cost.mana} maná` : `${cost.gold} oro`
    setConfirmModal({
      title: `Reparar ${item.item_catalog.name}`,
      body: `Coste estimado: ${costText}`,
      confirmLabel: 'Reparar',
      onConfirm: () => { setConfirmModal(null); callApi('/api/item-repair', { itemId: item.id }) },
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
        // Optimistic: quitar de la mochila al instante
        const current = optimisticItems ?? items
        setOptimisticItems((current ?? []).filter(i => i.id !== item.id))
        callApi('/api/item-dismantle', { itemId: item.id })
      },
    })
  }

  async function callCardApi(endpoint, body) {
    setActionLoading(true)
    setError(null)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setActionLoading(false)
    if (!res.ok) setError(data.error ?? 'Error')
    else refetchCards()
  }

  function handleCardEquip(cardId)   { callCardApi('/api/card-equip', { cardId, equip: true  }) }
  function handleCardUnequip(cardId) { callCardApi('/api/card-equip', { cardId, equip: false }) }
  function handleCardFuse(id1, id2)  { callCardApi('/api/card-fuse',  { cardId1: id1, cardId2: id2 }) }

  async function handleRest() {
    setRestLoading(true)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/hero-rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ heroId: hero.id }),
    })
    setRestLoading(false)
    refetchHero()
  }

  return (
    <div className="hero-section">
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
            recovering={hero.status === 'resting'}
          />
          {hero.status !== 'exploring' && (
            <button
              className={`btn btn--ghost btn--full hero-rest-btn ${hero.status === 'resting' ? 'hero-rest-btn--active' : ''}`}
              onClick={handleRest}
              disabled={restLoading}
            >
              {hero.status === 'resting'
                ? <><Sun size={14} strokeWidth={2} /> Despertar</>
                : <><Moon size={14} strokeWidth={2} /> Descansar</>
              }
            </button>
          )}

          <StatRadar
            effective={{ attack: effective.attack, defense: effective.defense, strength: effective.strength, agility: effective.agility, intelligence: effective.intelligence }}
            base={{ attack: hero.attack, defense: hero.defense, strength: hero.strength, agility: hero.agility, intelligence: hero.intelligence }}
            classColor={cls?.color}
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

          {(cards ?? []).filter(c => c.equipped).length === 0 ? (
            <p className="hero-cards-empty">Sin cartas equipadas. Abre la colección para equipar.</p>
          ) : (
            <div className="equipped-cards-grid">
              {(cards ?? []).filter(c => c.equipped).map(card => (
                <CardChip key={card.id} card={card} onUnequip={handleCardUnequip} loading={actionLoading} isOccupied={isOccupied} />
              ))}
            </div>
          )}
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

          {error && !bagOpen && <p className="inv-error">{error}</p>}

          {/* Armadura */}
          <div className="eq-group eq-group--armor">
            <div className="eq-group-header">
              <Shield size={11} strokeWidth={2.5} className="eq-group-icon" />
              <span className="eq-group-name">Armadura</span>
            </div>
            <div className="eq-slots-grid">
              {['helmet', 'chest', 'arms', 'legs'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onUnequip={handleUnequip} onRepair={handleRepair} loading={actionLoading} isOccupied={isOccupied} />
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
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onUnequip={handleUnequip} onRepair={handleRepair} loading={actionLoading} isOccupied={isOccupied} />
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
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onUnequip={handleUnequip} onRepair={handleRepair} loading={actionLoading} isOccupied={isOccupied} />
              ))}
            </div>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {bagOpen && (
          <BagModal
            bag={bag}
            bagLimit={bagLimit}
            onEquip={handleEquip}
            onDiscard={handleDiscard}
            loading={actionLoading}
            error={error}
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
            loading={actionLoading}
            error={error}
            onClose={() => { setCardModalOpen(false); setError(null) }}
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
    </div>
  )
}

export default Hero
