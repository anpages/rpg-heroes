import { useState, useEffect, useReducer, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { INVENTORY_BASE_LIMIT, BAG_SLOTS_PER_UPGRADE, computeResearchBonuses, CLASS_COLORS } from '../lib/gameConstants'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { useTrainingTokens } from '../hooks/useTrainingTokens'
import DismantleChoiceModal from '../components/DismantleChoiceModal'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useResources } from '../hooks/useResources'
import { useResearch } from '../hooks/useResearch'
import { useHeroTactics } from '../hooks/useHeroTactics'
import {
  Sword, Shield, Heart, Dumbbell, Wind, Brain, CircleDot,
  Crown, Shirt, Hand, Move, Gem, Trash2, Backpack, X,
  Wrench, Info, Pencil, Check, Telescope, Award, Plus,
} from 'lucide-react'
import { tierForRating } from '../lib/combatRating'
import { interpolateHp } from '../lib/hpInterpolation'
import { xpRequiredForLevel, computeEffectiveStats } from '../lib/gameFormulas'
import { motion, AnimatePresence } from 'framer-motion'
import { ItemDetailModal } from '../components/ItemDetailModal'

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

const EASE_OUT = [0.22, 1, 0.36, 1]
const EASE_IN  = [0.55, 0, 0.75, 0.06]

const sheetVariants = {
  initial: { y: '100%' },
  animate: { y: 0,      transition: { type: 'tween', ease: EASE_OUT, duration: 0.26 } },
  exit:    { y: '100%', transition: { type: 'tween', ease: EASE_IN,  duration: 0.18 } },
}

const overlayTransition = { duration: 0.15 }

/* ─── Stats detail modal ─────────────────────────────────────────────────────── */

const ALL_STATS = [
  { key: 'max_hp',       label: 'HP Máximo',    Icon: Heart,    color: '#dc2626' },
  { key: 'attack',       label: 'Ataque',       Icon: Sword,    color: '#d97706' },
  { key: 'defense',      label: 'Defensa',      Icon: Shield,   color: '#475569' },
  { key: 'strength',     label: 'Fuerza',       Icon: Dumbbell, color: '#dc2626' },
  { key: 'agility',      label: 'Agilidad',     Icon: Wind,     color: '#2563eb' },
  { key: 'intelligence', label: 'Inteligencia', Icon: Brain,    color: '#7c3aed' },
]


function StatsDetailModal({ hero, items, effectiveStats = {}, researchBonuses = {}, tactics = [], onClose }) {
  const RESEARCH_PCT_MAP = { attack: 'attack_pct', defense: 'defense_pct', intelligence: 'intelligence_pct' }

  // Equipo equipado con durabilidad aplicada (igual que computeEffectiveStats)
  const equippedItems = (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .map(i => {
      const c = i.item_catalog
      const durPct = c.max_durability > 0 ? i.current_durability / c.max_durability : 1
      const enc = i.enchantments ?? {}
      const contrib = {
        attack:       Math.round((c.attack_bonus       ?? 0) * durPct) + Math.round((enc.attack_bonus       ?? 0) * durPct),
        defense:      Math.round((c.defense_bonus      ?? 0) * durPct) + Math.round((enc.defense_bonus      ?? 0) * durPct),
        max_hp:       Math.round((c.hp_bonus           ?? 0) * durPct) + Math.round((enc.hp_bonus           ?? 0) * durPct),
        strength:     Math.round((c.strength_bonus     ?? 0) * durPct) + Math.round((enc.strength_bonus     ?? 0) * durPct),
        agility:      Math.round((c.agility_bonus      ?? 0) * durPct) + Math.round((enc.agility_bonus      ?? 0) * durPct),
        intelligence: Math.round((c.intelligence_bonus ?? 0) * durPct) + Math.round((enc.intelligence_bonus ?? 0) * durPct),
      }
      const durLabel = durPct < 1 ? ` (${Math.round(durPct * 100)}% dur)` : ''
      return { name: c.name, tier: c.tier, durLabel, contrib }
    })
    .filter(i => Object.values(i.contrib).some(v => v !== 0))

  const equippedTactics = (tactics ?? []).filter(t => t.slot_index != null)

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
        variants={overlayVariants} initial="initial" animate="animate" exit="exit"
        transition={overlayTransition}
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      >
        <motion.div
          className="w-full sm:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden max-h-[92dvh]"
          variants={sheetVariants} initial="initial" animate="animate" exit="exit"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex flex-col gap-0.5">
              <p className="text-[16px] font-bold text-text leading-none">Estadísticas</p>
              <p className="text-[12px] text-text-3">{hero.name}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3 transition-colors">
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Stats grid */}
          <div className="overflow-y-auto flex-1 min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
            {ALL_STATS.map(({ key, label, Icon, color }) => {
              const classBase   = hero.classes?.[key] ?? hero[key] ?? 0
              const trainingPts = (hero[key] ?? 0) - classBase
              const rows = []

              if (trainingPts > 0) {
                rows.push({ label: 'Entrenamiento', value: trainingPts, source: 'training' })
              }

              // Equipo escalado por durabilidad (incl. encantamientos)
              equippedItems.forEach(item => {
                const v = item.contrib[key]
                if (v !== 0) rows.push({ label: `${item.name} T${item.tier}${item.durLabel}`, value: v, source: 'equip' })
              })

              // Tácticas (antes de research para calcular la base correcta del %)
              for (const t of equippedTactics) {
                const cat = t.tactic_catalog
                for (const b of cat?.stat_bonuses ?? []) {
                  if (b.stat === key && b.value) {
                    const val = Math.round(b.value * (t.level ?? 1))
                    if (val !== 0) rows.push({ label: `${cat.name} Nv.${t.level ?? 1}`, value: val, source: 'tactic' })
                  }
                }
              }

              // Research % sobre la base+equipo+tácticas (igual que _stats.js)
              const pctKey = RESEARCH_PCT_MAP[key]
              if (pctKey && researchBonuses[pctKey]) {
                const subtotal = hero[key] + rows.reduce((s, r) => s + r.value, 0)
                const researchVal = Math.round(subtotal * researchBonuses[pctKey])
                if (researchVal !== 0) rows.push({ label: `Investigación (${Math.round(researchBonuses[pctKey] * 100)}%)`, value: researchVal, source: 'research' })
              }

              // Amplificación de tácticas por investigación
              if (researchBonuses.tactic_bonus_pct > 0) {
                for (const t of equippedTactics) {
                  const cat = t.tactic_catalog
                  for (const b of cat?.stat_bonuses ?? []) {
                    if (b.stat === key && b.value) {
                      const val = Math.round(b.value * (t.level ?? 1) * researchBonuses.tactic_bonus_pct)
                      if (val !== 0) rows.push({ label: `Amplif. tácticas (${Math.round(researchBonuses.tactic_bonus_pct * 100)}%)`, value: val, source: 'research' })
                    }
                  }
                }
              }

              // Peso (se aplica al final, igual que _stats.js)
              const weightPenalty = effectiveStats.weightPenalty ?? 0
              if (key === 'agility' && weightPenalty > 0) {
                rows.push({ label: 'Peso del equipo', value: -weightPenalty, source: 'weight' })
              }

              // Total autoritativo desde effectiveStats (no recalculado)
              const total = effectiveStats[key] ?? Math.max(0, classBase + rows.reduce((s, r) => s + r.value, 0))

              return (
                <div key={key} className="flex flex-col bg-surface-2 rounded-xl border border-border overflow-hidden">
                  <div style={{ height: '3px', background: color, flexShrink: 0 }} />

                  <div className="p-3.5 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} strokeWidth={2} style={{ color }} />
                        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-3">{label}</span>
                      </div>
                      <span className="text-[26px] font-black text-text tabular-nums leading-none">{total}</span>
                    </div>

                    <div className="flex flex-col gap-1 border-t border-border pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-text-3">Base</span>
                        <span className="text-[12px] font-semibold text-text-2 tabular-nums">{classBase}</span>
                      </div>
                      {rows.length === 0 && (
                        <span className="text-[11px] text-text-3 italic mt-0.5">Sin modificadores</span>
                      )}
                      {rows.map((r, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 min-w-0">
                            {r.source === 'training' && <Dumbbell size={10} strokeWidth={2} className="text-[#dc2626] flex-shrink-0" />}
                            {r.source === 'research' && <Telescope size={10} strokeWidth={2} className="text-[#0f766e] flex-shrink-0" />}
                            {r.source === 'tactic' && <Gem size={10} strokeWidth={2} className="text-[#7c3aed] flex-shrink-0" />}
                            <span className={`text-[11px] truncate ${r.source === 'training' ? 'text-[#dc2626]' : r.source === 'research' ? 'text-[#0f766e]' : r.source === 'tactic' ? 'text-[#7c3aed]' : 'text-text-2'}`}>{r.label}</span>
                          </div>
                          <span className={`text-[13px] font-extrabold tabular-nums flex-shrink-0 ${r.value > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                            {r.value > 0 ? '+' : ''}{r.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

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
            <span className="text-[13px] font-bold text-text text-right">{total}</span>
          </div>
        )
      })}
    </div>
  )
}

const TOKEN_STATS = [
  { key: 'strength',     label: 'FUE',   Icon: Dumbbell, color: '#dc2626' },
  { key: 'agility',      label: 'AGI',   Icon: Wind,     color: '#2563eb' },
  { key: 'attack',       label: 'ATQ',   Icon: Sword,    color: '#d97706' },
  { key: 'defense',      label: 'DEF',   Icon: Shield,   color: '#475569' },
  { key: 'max_hp',       label: 'HP',    Icon: Heart,    color: '#e11d48' },
  { key: 'intelligence', label: 'INT',   Icon: Brain,    color: '#7c3aed' },
]

function TokenAssignPanel({ tokens, onAssign }) {
  const available = TOKEN_STATS.filter(s => (tokens[s.key] ?? 0) > 0)
  if (available.length === 0) return null

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-border">
      <div className="flex items-center gap-1.5 px-0.5">
        <Award size={12} strokeWidth={2.5} className="text-[#d97706]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">
          Asignar tokens
        </span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {available.map(({ key, label, Icon, color }) => (
          <motion.button
            key={key}
            className="flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-bold"
            style={{ borderColor: color, color, background: `color-mix(in srgb, ${color} 6%, var(--surface))` }}
            onClick={() => onAssign(key)}
            whileTap={{ scale: 0.92 }}
          >
            <Icon size={11} strokeWidth={2} />
            +1 {label}
            <span className="text-text-3 font-medium ml-0.5">({tokens[key]})</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

/* ─── Hero status ─────────────────────────────────────────────────────────────── */

const STATUS_META = {
  idle:       { label: 'En reposo',  color: '#16a34a' },
  exploring:  { label: 'Explorando', color: '#d97706' },
  ready:      { label: 'Listo',      color: '#16a34a' },
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

const EQUIPMENT_SLOTS = ['helmet', 'chest', 'arms', 'legs', 'main_hand', 'off_hand', 'accessory', 'accessory_2']

const RUNE_META = {
  rune_attack:       { label: 'Ataque',       icon: '⚔️', stat: 'attack_bonus',       color: '#d97706' },
  rune_defense:      { label: 'Defensa',      icon: '🛡️', stat: 'defense_bonus',      color: '#6b7280' },
  rune_hp:           { label: 'Vida',         icon: '💚', stat: 'hp_bonus',            color: '#dc2626' },
  rune_strength:     { label: 'Fuerza',       icon: '💪', stat: 'strength_bonus',     color: '#b91c1c' },
  rune_agility:      { label: 'Agilidad',     icon: '💨', stat: 'agility_bonus',      color: '#2563eb' },
  rune_intelligence: { label: 'Inteligencia', icon: '🔮', stat: 'intelligence_bonus', color: '#7c3aed' },
}

// estimateRepairCost ya no se usa — las reparaciones consumen kits crafteados

/* ─── Shared sub-components ───────────────────────────────────────────────────── */

function XpBar({ level, experience }) {
  const needed = xpRequiredForLevel(level)
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
      {lowHpExplore && !recovering && (
        <p className="text-[12px] text-[#dc2626] font-medium -mt-0.5">
          HP bajo — el héroe no puede combatir ni explorar. ¡Descansa!
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
      className="fixed inset-0 bg-black/60 z-[2000] flex items-end sm:items-center justify-center sm:p-5"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={overlayTransition}
      onClick={onCancel}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-3 p-5 w-full"
        style={{ maxWidth: 'min(360px, 100vw)' }}
        variants={sheetVariants} initial="initial" animate="animate" exit="exit"
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

function BagItem({ item, onDiscard, onViewDetail, loading, isOccupied }) {
  const catalog  = item.item_catalog
  const rarity   = RARITY_META[catalog.rarity]
  const slotMeta = SLOT_META[catalog.slot]
  const hasEnchants = item.enchantments && Object.values(item.enchantments).some(v => v > 0)
  const enchantCount = hasEnchants ? Object.values(item.enchantments).filter(v => v > 0).length : 0

  return (
    <div className="bg-surface border border-border rounded-[10px] flex flex-col overflow-hidden">
      <button className="p-3 flex flex-col gap-1.5 text-left w-full hover:bg-surface-2 transition-colors" onClick={() => onViewDetail(item)}>
        <div className="flex items-start justify-between gap-1.5">
          <span className="text-[13px] font-bold leading-[1.3] flex-1" style={{ color: rarity.color }}>{catalog.name}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasEnchants && <span className="text-[10px] font-bold px-[5px] py-px rounded-[4px] border" style={{ color: '#7c3aed', background: 'color-mix(in srgb,#7c3aed 10%,var(--surface-2))', borderColor: 'color-mix(in srgb,#7c3aed 25%,var(--border))' }}>✨{enchantCount}</span>}
            <span className="text-[10px] font-bold bg-surface-2 border border-border rounded-[4px] px-[5px] py-px text-text-2">T{catalog.tier}</span>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold" style={{ color: rarity.color }}>{rarity.label}</span>
          <span className="text-[11px] font-semibold text-text-3">{slotMeta.label}</span>
          {catalog.is_two_handed && <span className="text-[11px] font-semibold text-[#d97706]">2 manos</span>}
        </div>
        <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
      </button>
      <div className="flex border-t border-border">
        <button className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-text-3 hover:text-[#dc2626] hover:bg-[color-mix(in_srgb,#dc2626_5%,transparent)] transition-colors disabled:opacity-40"
          onClick={() => onDiscard(item)} disabled={loading || isOccupied} title={isOccupied ? 'El héroe está en expedición' : undefined}>
          <Trash2 size={11} strokeWidth={2} /> Descartar
        </button>
      </div>
    </div>
  )
}

/* ─── Common modal content helpers ───────────────────────────────────────────── */

function LockedNotice() {
  return <p className="text-[12px] text-[#d97706] bg-[color-mix(in_srgb,#d97706_8%,var(--surface))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] rounded-lg px-3 py-2 text-center">El héroe está en expedición — el equipo no se puede modificar.</p>
}

function InvError({ msg }) {
  return <p className="text-[13px] text-[#dc2626] bg-error-bg border border-error-border rounded-lg px-[14px] py-[10px]">{msg}</p>
}

function BagEmpty({ children }) {
  return <p className="text-[14px] text-text-3 py-10 px-5 text-center bg-surface border border-dashed border-border rounded-xl">{children}</p>
}

/* ─── Bag modal ───────────────────────────────────────────────────────────────── */

function BagModal({ bag, bagLimit, onDiscard, onViewDetail, loading, error, onClose, isOccupied }) {
  return createPortal(
    <ModalOverlay onClick={onClose}>
      <ModalPanel sv={sheetVariants} onClick={e => e.stopPropagation()}>
        <ModalHeader icon={Backpack} title="Mochila" subtitle={`${bag.length} / ${bagLimit}`} onClose={onClose} />
        {error      && <InvError msg={error} />}
        {isOccupied && <LockedNotice />}
        {bag.length === 0
          ? <BagEmpty>La mochila está vacía. Explora mazmorras para conseguir equipo.</BagEmpty>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
              {bag.map(item => (
                <BagItem key={item.id} item={item} onDiscard={onDiscard} onViewDetail={onViewDetail} loading={loading} isOccupied={isOccupied} />
              ))}
            </div>
          )
        }
      </ModalPanel>
    </ModalOverlay>,
    document.body
  )
}


/* ─── Slot picker sheet ───────────────────────────────────────────────────────── */

function SlotPickerSheet({ slot, equippedItem, bagItems, onEquip, onUnequip, onRepair, loading, isOccupied, heroClass, onClose }) {
  const meta = SLOT_META[slot]
  const Icon = meta.icon
  const compatible = bagItems.filter(i =>
    i.item_catalog.slot === slot &&
    (!i.item_catalog.required_class || i.item_catalog.required_class === heroClass)
  )

  return createPortal(
    <ModalOverlay onClick={onClose}>
      <ModalPanel sv={sheetVariants} onClick={e => e.stopPropagation()}>
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


/* ─── Item detail modal ───────────────────────────────────────────────────────── */


/* ─── Main component ──────────────────────────────────────────────────────────── */


function Hero() {
  const userId             = useAppStore(s => s.userId)
  const heroId             = useHeroId()
  const queryClient = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { items, loading: invLoading  } = useInventory(hero?.id)
  const { tactics }                    = useHeroTactics(hero?.id)
  const { resources } = useResources(userId)
  const { research }  = useResearch(userId)
  const { inventory: craftedItems } = useCraftedItems(userId)
  const { tokens: trainingTokens, totalTokens } = useTrainingTokens(userId)
  const researchBonuses = computeResearchBonuses(research.completed)
  const [bagOpen,        setBagOpen]        = useState(false)
  const [slotPicker,     setSlotPicker]     = useState(null)
  const [confirmModal,   setConfirmModal]   = useState(null)
  const [dismantleTarget, setDismantleTarget] = useState(null)
  const [itemDetail,     setItemDetail]     = useState(null)
  const [statsDetailOpen, setStatsDetailOpen] = useState(false)
  const [renameOpen,  setRenameOpen]  = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  const assignPending = useRef(0)

  const renameMutation = useMutation({
    mutationFn: (name) => apiPost('/api/hero-rename', { heroId: hero?.id, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
      setRenameOpen(false)
    },
    onError: (err) => notify.error(err.message),
  })

  const assignTokenMutation = useMutation({
    mutationKey: ['training-assign'],
    mutationFn: ({ stat, amount }) => apiPost('/api/training-assign', { heroId: hero?.id, stat, amount }),
    onMutate: ({ stat }) => {
      assignPending.current++
      queryClient.setQueryData(queryKeys.hero(heroId), (old) => old ? { ...old, [stat]: (old[stat] ?? 0) + 1 } : old)
      queryClient.setQueryData(queryKeys.trainingTokens(userId), (old) => old ? { ...old, [stat]: Math.max(0, (old[stat] ?? 0) - 1) } : old)
    },
    onError: (err) => notify.error(err.message),
    onSettled: () => {
      assignPending.current--
      if (assignPending.current === 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.trainingTokens(userId) })
      }
    },
  })

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
      notify.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(hero?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
  })

  const itemUseMutation = useMutation({
    mutationFn: (recipeId) => apiPost('/api/item-use', { heroId: hero?.id, recipeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
    onError: err => notify.error(err.message),
  })

  const { catalog, inventory } = useCraftedItems(userId)
  const hpPotions = (catalog ?? [])
    .filter(c => c.effects?.some(e => e.type === 'hp_restore') && (inventory[c.id] ?? 0) > 0)
    .map(c => ({ ...c, quantity: inventory[c.id] ?? 0 }))

  const mutationPending = itemMutation.isPending

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])


  if (heroLoading || invLoading) return null
  if (!hero) return (
    <div className="text-text-3 text-[15px] p-10 text-center">
      {heroId ? 'No se encontró el héroe.' : 'Recluta tu primer héroe para comenzar.'}
    </div>
  )

  const cls          = hero.classes
  const activeExp    = hero.expeditions?.find(e => e.status === 'traveling')
  const expReady     = activeExp && new Date(activeExp.ends_at) <= Date.now()
  const derivedStatus = expReady ? 'ready'
    : activeExp ? 'exploring'
    : hero.status
  const status     = STATUS_META[derivedStatus] ?? STATUS_META.idle
  const isOccupied = derivedStatus === 'exploring'

  const equipped = EQUIPMENT_SLOTS.reduce((acc, slot) => {
    acc[slot] = items?.find(i => i.equipped_slot === slot) ?? null
    return acc
  }, {})

  const effective    = computeEffectiveStats(hero, items ?? [], tactics ?? [], researchBonuses) ?? {}

  const hpNow    = interpolateHp(hero, Date.now(), effective.max_hp)
  const bag      = items?.filter(i => !i.equipped_slot) ?? []
  const bagLimit = INVENTORY_BASE_LIMIT + (resources?.bag_extra_slots ?? 0) * BAG_SLOTS_PER_UPGRADE

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
    const kits = craftedItems?.repair_kit ?? 0
    setConfirmModal({
      title: `Reparar ${item.item_catalog.name}`,
      body: kits > 0
        ? `Usar 1 Kit de Reparación (tienes ${kits})`
        : 'No tienes Kits de Reparación. Craftéalos en el Laboratorio.',
      confirmLabel: kits > 0 ? 'Reparar' : null,
      onConfirm: kits > 0 ? () => {
        setConfirmModal(null)
        itemMutation.mutate({ endpoint: '/api/item-repair', body: { itemId: item.id } })
      } : undefined,
    })
  }

  function handleDiscard(item) {
    setDismantleTarget(item)
  }

  return (
    <motion.div key="hero-content" className="overflow-x-hidden flex flex-col gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 items-start">

        {/* Left column: hero card only */}
        <div className="flex flex-col gap-4">

          {/* Hero card */}
          <div className="bg-surface border border-border rounded-xl p-4 md:p-6 shadow-[var(--shadow-sm)] flex flex-col gap-3.5 md:gap-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                <Sword size={32} strokeWidth={1.5} color={cls?.color} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                {renameOpen ? (
                  <form
                    className="flex items-center gap-1.5"
                    onSubmit={e => { e.preventDefault(); renameMutation.mutate(renameDraft) }}
                  >
                    <input
                      autoFocus
                      className="font-hero text-[18px] font-bold text-text bg-surface-2 border border-border rounded-lg px-2 py-0.5 min-w-0 flex-1 outline-none focus:border-[var(--blue-400)] transition-colors"
                      value={renameDraft}
                      maxLength={20}
                      onChange={e => setRenameDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && setRenameOpen(false)}
                    />
                    <button
                      type="submit"
                      disabled={renameMutation.isPending || renameDraft.trim().length < 2}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--blue-400)] text-white disabled:opacity-40 flex-shrink-0 transition-opacity"
                    >
                      <Check size={13} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3 flex-shrink-0 transition-colors"
                      onClick={() => setRenameOpen(false)}
                    >
                      <X size={13} strokeWidth={2} />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h3 className="font-hero text-[20px] md:text-[24px] font-bold tracking-[0.02em] text-text leading-none truncate">{hero.name}</h3>
                    <button
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface-2 text-text-3 flex-shrink-0 transition-[opacity,background] duration-150"
                      onClick={() => { setRenameDraft(hero.name); setRenameOpen(true) }}
                      title="Cambiar nombre"
                    >
                      <Pencil size={12} strokeWidth={2} />
                    </button>
                  </div>
                )}
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
                  {(() => {
                    const t = tierForRating(hero.combat_rating ?? 0)
                    return (
                      <span
                        className="flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-[6px] border"
                        style={{
                          color: t.color,
                          background:  `color-mix(in srgb, ${t.color} 10%, var(--surface))`,
                          borderColor: `color-mix(in srgb, ${t.color} 30%, var(--border))`,
                        }}
                        title={`Rating: ${hero.combat_rating ?? 0} pts · ${hero.combats_played ?? 0} combates`}
                      >
                        <Shield size={10} strokeWidth={2.5} />
                        {t.label}
                      </span>
                    )
                  })()}
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
                  const disabled = empty || full || isOccupied || itemUseMutation.isPending
                  return (
                    <motion.button
                      key={p.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-[opacity] duration-150 disabled:opacity-40"
                      style={{
                        color:       'var(--text-2)',
                        borderColor: 'var(--border)',
                        background:  'var(--surface-2)',
                      }}
                      onClick={() => !disabled && itemUseMutation.mutate(p.id)}
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

            {/* Token assignment */}
            {totalTokens > 0 && (
              <TokenAssignPanel
                tokens={trainingTokens}
                onAssign={(stat) => assignTokenMutation.mutate({ stat, amount: 1 })}
              />
            )}

            <button
              className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-text-3 hover:text-text-2 w-full py-1.5 rounded-lg hover:bg-surface-2 border border-transparent hover:border-border transition-colors"
              onClick={() => setStatsDetailOpen(true)}
            >
              <Info size={11} strokeWidth={2} />
              Desglose de stats
            </button>

          </div>

          {statsDetailOpen && (
            <StatsDetailModal
              hero={hero}
              items={items}
              effectiveStats={effective}
              researchBonuses={researchBonuses}
              tactics={tactics ?? []}
              onClose={() => setStatsDetailOpen(false)}
            />
          )}

        </div>

        {/* Right column: equipment */}
        <div className="flex flex-col gap-4">

          {/* Equipment preview */}
          <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)] flex flex-col gap-3">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-text-3">Equipado</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {EQUIPMENT_SLOTS.map(slot => {
                const item     = equipped[slot]
                const meta     = SLOT_META[slot]
                const Icon     = meta.icon
                const cat      = item?.item_catalog
                const rarColor = cat ? (RARITY_META[cat.rarity]?.color ?? '#6b7280') : null
                if (item) {
                  const durPct   = Math.round((item.current_durability / cat.max_durability) * 100)
                  const durColor = durPct > 60 ? '#16a34a' : durPct > 30 ? '#d97706' : '#dc2626'
                  const isClassItem = cat.required_class && cat.required_class === hero?.class
                  const classColor  = CLASS_COLORS[cat.required_class]
                  return (
                    <button
                      key={slot}
                      className="flex rounded-lg border border-border bg-surface min-w-0 text-left hover:bg-surface-2 transition-colors overflow-hidden"
                      style={isClassItem ? { borderColor: `color-mix(in srgb,${classColor} 40%,var(--border))` } : undefined}
                      onClick={() => setItemDetail(item)}
                    >
                      {isClassItem && <div className="w-1 flex-shrink-0" style={{ background: `color-mix(in srgb,${classColor} 60%,transparent)` }} />}
                      <div className="flex flex-col gap-1.5 p-2.5 flex-1 min-w-0">
                      {/* Row 1: slot label + tier */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <Icon size={11} strokeWidth={1.8} className="text-text-3 flex-shrink-0" />
                          <span className="text-[11px] font-semibold text-text-3 truncate">{meta.label}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {item.enchantments && Object.values(item.enchantments).some(v => v > 0) && (
                            <span className="text-[11px] font-bold px-1 rounded border" style={{ color: '#7c3aed', background: 'color-mix(in srgb,#7c3aed 12%,var(--surface-2))', borderColor: 'color-mix(in srgb,#7c3aed 25%,var(--border))' }}>
                              ✨{Object.values(item.enchantments).filter(v => v > 0).length}
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-text-3 bg-surface-2 border border-border rounded px-1">T{cat.tier}</span>
                        </div>
                      </div>
                      {/* Row 2: item name */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[13px] font-bold leading-tight truncate" style={{ color: rarColor }}>{cat.name}</span>
                        {cat.is_two_handed && <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: '#d97706' }}>2 manos</span>}
                      </div>
                      {/* Row 3: durability */}
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[11px] font-bold flex-shrink-0" style={{ color: durColor }}>{durPct}%</span>
                      </div>
                      <div className="w-full h-[3px] bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${durPct}%`, background: durColor }} />
                      </div>
                      </div>
                    </button>
                  )
                }
                return (
                  <div key={slot} className="flex flex-col gap-1 p-2.5 rounded-lg border border-dashed border-border bg-surface-2/50 min-w-0">
                    <div className="flex items-center gap-1">
                      <Icon size={11} strokeWidth={1.8} className="text-text-3 flex-shrink-0" />
                      <span className="text-[11px] font-semibold text-text-3 truncate">{meta.label}</span>
                    </div>
                    <span className="text-[12px] text-text-3 italic">Vacío</span>
                  </div>
                )
              })}
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
            heroClass={hero.class}
            onClose={() => setSlotPicker(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bagOpen && (
          <BagModal
            bag={bag}
            bagLimit={bagLimit}
            onDiscard={handleDiscard}
            onViewDetail={setItemDetail}
            loading={mutationPending}
            onClose={() => setBagOpen(false)}
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

      <AnimatePresence>
        {dismantleTarget && (
          <DismantleChoiceModal
            item={dismantleTarget}
            gold={resources?.gold ?? 0}
            onSell={() => {
              const item = dismantleTarget
              setDismantleTarget(null)
              itemMutation.mutate({
                endpoint: '/api/item-dismantle',
                body: { itemId: item.id },
                optimisticUpdate: items?.filter(i => i.id !== item.id),
              })
            }}
            onTransmute={() => {
              const item = dismantleTarget
              setDismantleTarget(null)
              itemMutation.mutate({
                endpoint: '/api/item-transmute',
                body: { itemId: item.id },
                optimisticUpdate: items?.filter(i => i.id !== item.id),
              })
            }}
            onCancel={() => setDismantleTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {itemDetail && <ItemDetailModal item={itemDetail} onClose={() => setItemDetail(null)} heroClass={hero?.class} />}
      </AnimatePresence>

    </motion.div>
  )
}

export default Hero
