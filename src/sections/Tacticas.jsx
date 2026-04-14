import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHeroTactics } from '../hooks/useHeroTactics'
import { useResources } from '../hooks/useResources'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { TACTIC_SLOT_COUNT, TACTIC_MAX_LEVEL } from '../lib/gameConstants'
import { X, Coins, Sparkles, Plus, ArrowUp, ChevronRight } from 'lucide-react'

/* ─── Constantes ─────────────────────────────────────────────────────────────── */

const RARITY_COLORS = {
  common: '#6b7280', uncommon: '#16a34a', rare: '#2563eb', epic: '#7c3aed', legendary: '#d97706',
}
const RARITY_LABELS = {
  common: 'Común', uncommon: 'Poco Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
}
const CATEGORY_LABELS = {
  offensive: 'Ofensiva', defensive: 'Defensiva', tactical: 'Táctica', utility: 'Utilidad',
}
const CATEGORY_COLORS = {
  offensive: '#dc2626', defensive: '#2563eb', tactical: '#7c3aed', utility: '#16a34a',
}
const FILTER_TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'offensive', label: 'Ofensivas' },
  { key: 'defensive', label: 'Defensivas' },
  { key: 'tactical', label: 'Tácticas' },
  { key: 'utility', label: 'Utilidad' },
]
const STAT_LABELS = {
  attack: 'ATQ', defense: 'DEF', max_hp: 'HP',
  strength: 'FUE', agility: 'AGI', intelligence: 'INT',
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function scaledEffectValue(baseValue, level) {
  return baseValue * (1 + (level - 1) * 0.15)
}

function buildSlots(tactics) {
  const slots = Array.from({ length: TACTIC_SLOT_COUNT }, () => null)
  if (!tactics) return slots
  // Compactar: ordenar equipadas por slot_index y asignar a posiciones consecutivas
  const equipped = tactics
    .filter(t => t.slot_index != null && t.slot_index >= 0 && t.slot_index < TACTIC_SLOT_COUNT)
    .sort((a, b) => a.slot_index - b.slot_index)
  equipped.forEach((t, i) => { slots[i] = t })
  return slots
}

function firstFreeSlot(slots) {
  return slots.findIndex(s => s === null)
}

function firstFreeSlotIndex(tactics) {
  const used = new Set((tactics ?? []).filter(t => t.slot_index != null).map(t => t.slot_index))
  for (let i = 0; i < TACTIC_SLOT_COUNT; i++) {
    if (!used.has(i)) return i
  }
  return -1
}

function formatBonuses(catalog, level = 1) {
  const bonuses = catalog.stat_bonuses
  if (!Array.isArray(bonuses) || bonuses.length === 0) return ''
  return bonuses.filter(b => b.value).map(b => `+${b.value * level} ${STAT_LABELS[b.stat] ?? b.stat}`).join(' · ')
}

function describeCombatEffect(fx) {
  if (!fx || !fx.effect) return null
  const parts = []
  if (fx.trigger === 'start_of_combat') parts.push('Al inicio')
  else if (fx.trigger === 'passive') parts.push('Pasiva')
  else if (fx.trigger === 'hp_below_pct') parts.push(`HP < ${Math.round((fx.threshold ?? 0) * 100)}%`)
  else if (fx.trigger === 'round_n') parts.push(`Ronda ${fx.n}`)
  else if (fx.trigger === 'on_crit') parts.push('Al crítico')
  else if (fx.trigger === 'on_dodge') parts.push('Al esquivar')
  const e = fx.effect
  if (e === 'guaranteed_crit') parts.push('crítico garantizado')
  else if (e === 'damage_mult') parts.push(`daño ×${fx.value}`)
  else if (e === 'bonus_magic_damage') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% mágico`)
  else if (e === 'heal_pct') parts.push(`cura ${Math.round((fx.value ?? 0) * 100)}% HP`)
  else if (e === 'armor_pen_boost') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% penetración`)
  else if (e === 'double_attack') parts.push('ataque doble')
  else if (e === 'absorb_shield') parts.push(`escudo ${Math.round((fx.value ?? 0) * 100)}% HP`)
  else if (e === 'reduce_crit_damage') parts.push(`-${Math.round((fx.value ?? 0) * 100)}% daño crítico`)
  else if (e === 'damage_reduction') parts.push(`-${Math.round((fx.value ?? 0) * 100)}% daño`)
  else if (e === 'guaranteed_dodge') parts.push('esquiva garantizada')
  else if (e === 'damage_mult_next') parts.push(`siguiente ×${fx.value}`)
  else if (e === 'counter_attack') parts.push(`${Math.round((fx.chance ?? 0) * 100)}% contraataque`)
  else if (e === 'dodge_boost') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% esquiva`)
  else if (e === 'enemy_debuff') parts.push(`-${Math.round((fx.value ?? 0) * 100)}% ${STAT_LABELS[fx.stat] ?? fx.stat} enemigo`)
  else if (e === 'all_stats_pct') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% stats`)
  else if (e === 'stat_buff') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% ${STAT_LABELS[fx.stat] ?? fx.stat}`)
  else if (e === 'first_hit_mult') parts.push(`primer golpe ×${fx.value}`)
  else if (e === 'pure_magic_burst') parts.push(`explosión ${Math.round((fx.value ?? 0) * 100)}%`)
  else parts.push(e)
  if (fx.duration && fx.duration < 99) parts.push(`${fx.duration}t`)
  return parts.join(' · ')
}

/* ─── Modal confirmación de mejora ──────────────────────────────────────────── */

function UpgradeConfirmModal({ tactic, scrolls, onConfirm, onClose, isPending }) {
  const cat = tactic.tactic_catalog
  const level = tactic.level ?? 1
  const nextLevel = level + 1
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const bonuses = Array.isArray(cat.stat_bonuses) ? cat.stat_bonuses.filter(b => b.value) : []
  const fx = cat.combat_effect

  const MULT_EFFECTS = ['damage_mult', 'damage_mult_next', 'first_hit_mult']
  const fxHasScale = fx && fx.value != null && !['guaranteed_crit', 'double_attack', 'guaranteed_dodge'].includes(fx.effect)
  const fxCurrent = fxHasScale ? scaledEffectValue(fx.value, level) : null
  const fxNext = fxHasScale ? scaledEffectValue(fx.value, nextLevel) : null
  const fxIsMult = fx && MULT_EFFECTS.includes(fx.effect)
  const fmtFxVal = (v) => fxIsMult ? `×${v.toFixed(2)}` : `${Math.round(v * 100)}%`

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[300] flex items-end sm:items-center justify-center"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.3)] w-full sm:w-[380px] overflow-hidden"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg text-xl flex-shrink-0"
            style={{ background: `color-mix(in srgb,${rarColor} 14%,transparent)` }}>
            {cat.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-text truncate">{cat.name}</p>
            <p className="text-[11px] text-text-3">Nv. {level} → Nv. {nextLevel}</p>
          </div>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3" onClick={onClose}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          {bonuses.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1.5">Estadísticas</p>
              <div className="flex flex-col gap-1">
                {bonuses.map(b => (
                  <div key={b.stat} className="flex items-center justify-between">
                    <span className="text-[12px] text-text-2">{STAT_LABELS[b.stat] ?? b.stat}</span>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-[12px] text-text-3">+{b.value * level}</span>
                      <span className="text-[10px] text-text-3">→</span>
                      <span className="text-[13px] font-bold" style={{ color: rarColor }}>+{b.value * nextLevel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {fx && (
            <div>
              <p className="text-[10px] font-bold text-text-3 uppercase tracking-wider mb-1.5">Efecto de combate</p>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-2 flex-1 pr-2">{describeCombatEffect(fx)}</span>
                {fxHasScale ? (
                  <div className="flex items-center gap-2 tabular-nums flex-shrink-0">
                    <span className="text-[12px] text-text-3">{fmtFxVal(fxCurrent)}</span>
                    <span className="text-[10px] text-text-3">→</span>
                    <span className="text-[13px] font-bold" style={{ color: rarColor }}>{fmtFxVal(fxNext)}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-text-3">+15%</span>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-[12px] text-text-2">Coste</span>
            <div className="flex items-center gap-1.5">
              <span>📜</span>
              <span className="text-[13px] font-semibold text-text">×1 Pergamino Táctico</span>
              <span className="text-[11px] text-text-3">({scrolls} disp.)</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-text-2 bg-surface-2" onClick={onClose}>
            Cancelar
          </button>
          <button className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: rarColor }} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Mejorando…' : 'Mejorar'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

/* ─── SlotPickerModal — elige qué slot reemplazar ────────────────────────────── */

function SlotPickerModal({ tactic, slots, onPick, onClose }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[300] flex items-end sm:items-center justify-center"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.3)] w-full sm:w-[400px] overflow-hidden"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg text-xl flex-shrink-0"
            style={{ background: `color-mix(in srgb,${rarColor} 14%,transparent)` }}>
            {cat.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-text">Equipar {cat.name}</p>
            <p className="text-[12px] text-text-3">Todos los slots llenos — elige cuál reemplazar</p>
          </div>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3" onClick={onClose}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {slots.map((slot, i) => {
            if (!slot) return null
            const sc = slot.tactic_catalog
            const rc = RARITY_COLORS[sc.rarity] ?? '#6b7280'
            return (
              <button key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-surface text-left active:scale-[0.98] transition-transform"
                style={{ borderColor: `color-mix(in srgb,${rc} 35%,var(--border))` }}
                onClick={() => onPick(i)}
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-lg text-lg flex-shrink-0"
                  style={{ background: `color-mix(in srgb,${rc} 12%,transparent)` }}>
                  {sc.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text truncate">{sc.name}</p>
                  <p className="text-[11px] text-text-3">Nv. {slot.level ?? 1} · {RARITY_LABELS[sc.rarity]}</p>
                </div>
                <ChevronRight size={14} strokeWidth={2} className="text-text-3 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

/* ─── SlotCard ───────────────────────────────────────────────────────────────── */

function SlotCard({ tactic, onEmpty, onUnequip, onLevelUpClick, scrolls, isLevelingUp }) {
  if (!tactic) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-surface/20 overflow-hidden">
        {/* Mobile: horizontal */}
        <button className="lg:hidden flex items-center gap-3 p-3 w-full text-left" onClick={onEmpty}>
          <div className="w-10 h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center flex-shrink-0">
            <Plus size={16} strokeWidth={2} className="text-text-3 opacity-40" />
          </div>
          <span className="flex-1 text-[13px] text-text-3 opacity-50">Añadir táctica</span>
        </button>
        {/* Desktop: centered */}
        <button className="hidden lg:flex flex-col items-center justify-center gap-2.5 p-4 w-full text-center min-h-[150px]" onClick={onEmpty}>
          <div className="w-12 h-12 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
            <Plus size={18} strokeWidth={2} className="text-text-3 opacity-40" />
          </div>
          <span className="text-[13px] text-text-3 opacity-50">Añadir táctica</span>
        </button>
      </div>
    )
  }

  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const level = tactic.level ?? 1
  const bonuses = formatBonuses(cat, level)
  const effectDesc = describeCombatEffect(cat.combat_effect)
  const maxed = level >= TACTIC_MAX_LEVEL
  const hasScrolls = (scrolls ?? 0) > 0 && !isLevelingUp

  return (
    <div className="rounded-xl border bg-surface overflow-hidden" style={{ borderColor: rarColor }}>

      {/* Mobile: horizontal (como CollectionCard) */}
      <div className="lg:hidden flex items-center gap-3 p-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg text-xl"
            style={{ background: `color-mix(in srgb,${rarColor} 12%,transparent)` }}>
            {cat.icon}
          </div>
          <span className="absolute -bottom-1 -right-1 text-[9px] font-bold px-1 rounded-sm text-white leading-tight"
            style={{ background: maxed ? '#d97706' : rarColor }}>
            {maxed ? 'MAX' : `${level}`}
          </span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[14px] font-bold text-text truncate">{cat.name}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold" style={{ color: rarColor }}>{RARITY_LABELS[cat.rarity]}</span>
          </div>
          {bonuses && <span className="text-[12px] text-text-2">{bonuses}</span>}
          {effectDesc && <span className="text-[12px] text-text-3 leading-snug">{effectDesc}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full border border-border bg-surface-2 text-text-3 active:scale-95 transition-transform"
            onClick={onUnequip}
            title="Desequipar"
          >
            <X size={14} strokeWidth={2} />
          </button>
          <button
            className={`w-8 h-8 flex items-center justify-center rounded-full border transition-transform
              ${maxed
                ? 'border-[#d97706] text-[#d97706] opacity-50 cursor-default'
                : hasScrolls
                  ? 'border-[#16a34a] text-[#16a34a] active:scale-95'
                  : 'border-border text-text-3 opacity-30 cursor-default'}`}
            onClick={!maxed && hasScrolls ? onLevelUpClick : undefined}
            disabled={maxed || !hasScrolls}
            title={maxed ? 'Nivel máximo' : 'Mejorar'}
          >
            <ArrowUp size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Desktop: vertical card (como antes) */}
      <div className="hidden lg:flex flex-col min-h-[150px]">
        <div className="flex flex-col items-center gap-2 px-3 pt-4 pb-3 flex-1">
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl text-2xl"
              style={{ background: `color-mix(in srgb,${rarColor} 14%,transparent)` }}>
              {cat.icon}
            </div>
            <span className="absolute -bottom-1 -right-1 text-[9px] font-bold px-1 rounded-sm text-white leading-tight"
              style={{ background: maxed ? '#d97706' : rarColor }}>
              {maxed ? 'MAX' : `${level}`}
            </span>
          </div>
          <div className="w-full flex flex-col items-center gap-1 text-center">
            <span className="text-[14px] font-bold text-text leading-tight">{cat.name}</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: `color-mix(in srgb,${rarColor} 10%,var(--surface-2))`, color: rarColor }}>
              {RARITY_LABELS[cat.rarity]}
            </span>
            {bonuses && <span className="text-[12px] text-text-2 mt-0.5">{bonuses}</span>}
            {effectDesc && <span className="text-[12px] text-text-3 leading-snug">{effectDesc}</span>}
          </div>
        </div>
        <div className="flex border-t border-border">
          <button className="flex-1 py-2.5 text-[13px] font-semibold text-text-3 hover:bg-surface-2 transition-colors"
            onClick={onUnequip}>
            Desequipar
          </button>
          <div className="w-px bg-border" />
          <button
            className={`flex-1 py-2.5 text-[13px] font-semibold flex items-center justify-center gap-1 transition-colors
              ${maxed ? 'text-[#d97706] opacity-60 cursor-default' : hasScrolls ? 'text-[#16a34a] hover:bg-surface-2' : 'text-text-3 opacity-50 cursor-default'}`}
            onClick={!maxed && hasScrolls ? onLevelUpClick : undefined}
            disabled={maxed || !hasScrolls}
          >
            <ArrowUp size={12} strokeWidth={2.5} />
            {maxed ? 'Máx.' : 'Mejorar'}
          </button>
        </div>
      </div>

    </div>
  )
}

/* ─── CollectionCard — inline sin equipar ────────────────────────────────────── */

function CollectionCard({ tactic, onTap, slotsAvailable }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const catColor = CATEGORY_COLORS[cat.category] ?? '#6b7280'
  const bonuses = formatBonuses(cat, tactic.level ?? 1)
  const effectDesc = describeCombatEffect(cat.combat_effect)

  return (
    <button
      className="flex items-center gap-3 p-3 rounded-xl border bg-surface w-full text-left active:scale-[0.98] transition-transform"
      style={{ borderColor: `color-mix(in srgb,${rarColor} 30%,var(--border))` }}
      onClick={() => onTap(tactic)}
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-lg text-xl flex-shrink-0"
        style={{ background: `color-mix(in srgb,${rarColor} 12%,transparent)` }}>
        {cat.icon}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[14px] font-bold text-text truncate">{cat.name}</span>
          {(tactic.level ?? 1) > 1 && (
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md text-white"
              style={{ background: rarColor }}>Nv.{tactic.level}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold" style={{ color: rarColor }}>{RARITY_LABELS[cat.rarity]}</span>
          <span className="text-[11px] text-text-3">·</span>
          <span className="text-[11px] font-semibold" style={{ color: catColor }}>{CATEGORY_LABELS[cat.category]}</span>
        </div>
        {bonuses && <span className="text-[12px] text-text-2">{bonuses}</span>}
        {effectDesc && <span className="text-[12px] text-text-3 leading-snug">{effectDesc}</span>}
      </div>
      <div className="flex-shrink-0">
        <span className="flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg text-white"
          style={{ background: slotsAvailable ? '#7c3aed' : '#6b7280' }}>
          {slotsAvailable ? 'Equipar' : 'Cambiar'}
          <ChevronRight size={12} strokeWidth={2.5} />
        </span>
      </div>
    </button>
  )
}

/* ─── Modal inventario (filtros) ─────────────────────────────────────────────── */

function InventoryModal({ collection, slots, onEquip, onClose }) {
  const [filter, setFilter] = useState('all')
  const slotsAvailable = firstFreeSlot(slots) !== -1

  const filtered = useMemo(() => {
    if (filter === 'all') return collection
    return collection.filter(t => t.tactic_catalog.category === filter)
  }, [collection, filter])

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden w-full sm:w-[440px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maxHeight: '80dvh' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <p className="text-[15px] font-bold text-text">Colección de tácticas</p>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3" onClick={onClose}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3 pb-2 flex-shrink-0">
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key
            return (
              <button key={tab.key}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap flex-shrink-0 ${
                  active ? 'bg-surface-2 border-border text-text' : 'border-transparent text-text-3 hover:text-text-2'
                }`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Sparkles size={24} strokeWidth={1.5} className="text-text-3 opacity-40" />
              <p className="text-[13px] text-text-3">
                {collection.length === 0 ? 'Todas las tácticas están equipadas' : 'Sin tácticas en esta categoría'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              {filtered.map(t => (
                <CollectionCard key={t.tactic_id} tactic={t} onTap={onEquip} slotsAvailable={slotsAvailable} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

/* ─── Componente principal ───────────────────────────────────────────────────── */

export default function Tacticas() {
  const userId = useAppStore(s => s.userId)
  const heroId = useHeroId()
  const { tactics, loading } = useHeroTactics(heroId)
  const { resources } = useResources(userId)
  const { inventory } = useCraftedItems(userId)
  const queryClient = useQueryClient()

  const scrolls = inventory['tactic_scroll'] ?? 0

  const [inventoryOpen, setInventoryOpen]       = useState(false)
  const [upgradeConfirmSlot, setUpgradeConfirmSlot] = useState(null)
  const [slotPickerTactic, setSlotPickerTactic] = useState(null)

  const slots = useMemo(() => buildSlots(tactics), [tactics])

  const collection = useMemo(() => {
    if (!tactics) return []
    return [...tactics.filter(t => t.slot_index == null)].sort((a, b) => {
      const rarOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common']
      const ra = rarOrder.indexOf(a.tactic_catalog.rarity)
      const rb = rarOrder.indexOf(b.tactic_catalog.rarity)
      if (ra !== rb) return ra - rb
      return (a.tactic_catalog.name ?? '').localeCompare(b.tactic_catalog.name ?? '')
    })
  }, [tactics])

  const tacticsKey = queryKeys.heroTactics(heroId)

  function optimisticApply(tacticId, slotIndex) {
    const prev = queryClient.getQueryData(tacticsKey)
    queryClient.setQueryData(tacticsKey, (old) => {
      if (!old) return old
      return old.map(t => {
        if (t.tactic_id === tacticId) return { ...t, slot_index: slotIndex ?? null }
        if (slotIndex != null && t.slot_index === slotIndex) return { ...t, slot_index: null }
        return t
      })
    })
    return prev
  }

  const equipMutation = useMutation({
    mutationKey: ['tactic-equip'],
    mutationFn: ({ heroId: hid, tacticId, slotIndex }) =>
      apiPost('/api/tactic-equip', { heroId: hid, tacticId, slotIndex }),
    onMutate: ({ tacticId, slotIndex }) => {
      setInventoryOpen(false)
      setSlotPickerTactic(null)
      const prev = optimisticApply(tacticId, slotIndex)
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(tacticsKey, ctx.prev)
      notify.error(err.message)
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['tactic-equip'] }) === 0)
        queryClient.invalidateQueries({ queryKey: tacticsKey })
    },
  })

  const unequipMutation = useMutation({
    mutationKey: ['tactic-equip'],
    mutationFn: ({ heroId: hid, tacticId }) =>
      apiPost('/api/tactic-equip', { heroId: hid, tacticId, slotIndex: null }),
    onMutate: ({ tacticId }) => {
      const prev = optimisticApply(tacticId, null)
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(tacticsKey, ctx.prev)
      notify.error(err.message)
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['tactic-equip'] }) === 0)
        queryClient.invalidateQueries({ queryKey: tacticsKey })
    },
  })

  const levelUpMutation = useMutation({
    mutationKey: ['tactic-levelup'],
    mutationFn: ({ heroId: hid, tacticRowId }) =>
      apiPost('/api/tactic-levelup', { heroId: hid, tacticId: tacticRowId }),
    onMutate: async ({ tacticRowId }) => {
      const craftedKey = queryKeys.craftedItems(userId)
      await queryClient.cancelQueries({ queryKey: tacticsKey })
      await queryClient.cancelQueries({ queryKey: craftedKey })
      const prev = queryClient.getQueryData(tacticsKey)
      const prevCrafted = queryClient.getQueryData(craftedKey)
      queryClient.setQueryData(tacticsKey, (old) => {
        if (!old) return old
        return old.map(t => t.id === tacticRowId ? { ...t, level: (t.level ?? 1) + 1 } : t)
      })
      queryClient.setQueryData(craftedKey, (old) => {
        if (!old) return old
        return { ...old, tactic_scroll: Math.max(0, (old.tactic_scroll ?? 0) - 1) }
      })
      return { prev, prevCrafted }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(tacticsKey, ctx.prev)
      if (ctx?.prevCrafted) queryClient.setQueryData(queryKeys.craftedItems(userId), ctx.prevCrafted)
      notify.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tacticsKey })
      queryClient.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) })
    },
  })

  function handleUnequip(slotIndex) {
    const slot = slots[slotIndex]
    if (!slot) return
    unequipMutation.mutate({ heroId, tacticId: slot.tactic_id })
  }

  function handleLevelUp(slotIndex) {
    const slot = slots[slotIndex]
    if (!slot) return
    setUpgradeConfirmSlot(null)
    levelUpMutation.mutate({ heroId, tacticRowId: slot.id })
  }

  function handleEquip(tactic) {
    const targetSlot = firstFreeSlotIndex(tactics)
    if (targetSlot === -1) {
      setSlotPickerTactic(tactic)
      return
    }
    equipMutation.mutate({ heroId, tacticId: tactic.tactic_id, slotIndex: targetSlot })
  }

  function handleEquipInSlot(displayIndex) {
    if (!slotPickerTactic) return
    // Usar el slot_index real de la táctica que se va a reemplazar
    const existing = slots[displayIndex]
    const actualSlotIndex = existing?.slot_index ?? displayIndex
    equipMutation.mutate({ heroId, tacticId: slotPickerTactic.tactic_id, slotIndex: actualSlotIndex })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-text-3 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const equippedCount = slots.filter(Boolean).length
  const slotsAvailable = firstFreeSlot(slots) !== -1

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sparkles size={18} strokeWidth={2} className="text-[#7c3aed]" />
          <h2 className="text-[17px] font-bold text-text">Tácticas</h2>
          <span className="text-[13px] font-semibold text-text-3">{equippedCount}/{TACTIC_SLOT_COUNT} equipadas</span>
        </div>
        <div className="flex items-center gap-3">
          {scrolls > 0 && (
            <div className="flex items-center gap-1 text-[13px] font-semibold text-[#16a34a]">
              <span>📜</span>
              <span className="tabular-nums">×{scrolls}</span>
            </div>
          )}
          {resources && (
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
              <Coins size={14} strokeWidth={2} className="text-[#d97706]" />
              <span className="tabular-nums">{resources.gold?.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* 5 slots */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-2.5">
        {slots.map((slot, i) => (
          <SlotCard
            key={i}
            tactic={slot}
            onEmpty={() => setInventoryOpen(true)}
            onUnequip={() => handleUnequip(i)}
            onLevelUpClick={() => setUpgradeConfirmSlot(i)}
            scrolls={scrolls}
            isLevelingUp={levelUpMutation.isPending}
          />
        ))}
      </div>

      {/* Colección — solo en desktop */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[16px] font-bold text-text">
              {collection.length === 0 ? 'Sin tácticas guardadas' : `Sin equipar · ${collection.length}`}
            </span>
            <p className="text-[12px] text-text-3 mt-0.5">Sin límite de almacenamiento</p>
          </div>
          <button
            className="flex items-center gap-1 text-[13px] font-semibold text-[#7c3aed]"
            onClick={() => setInventoryOpen(true)}
          >
            Ver colección <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>

        {collection.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-xl border border-dashed border-border">
            <Sparkles size={22} strokeWidth={1.5} className="text-text-3 opacity-40" />
            <p className="text-[13px] text-text-3 text-center">
              {equippedCount === TACTIC_SLOT_COUNT
                ? 'Todas tus tácticas están equipadas.'
                : 'Consigue tácticas en expediciones, torneos y combates.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {collection.map(t => (
              <CollectionCard
                key={t.tactic_id}
                tactic={t}
                onTap={handleEquip}
                slotsAvailable={slotsAvailable}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      <AnimatePresence>
        {inventoryOpen && (
          <InventoryModal
            key="inventory"
            collection={collection}
            slots={slots}
            onEquip={handleEquip}
            onClose={() => setInventoryOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {slotPickerTactic && (
          <SlotPickerModal
            key="slot-picker"
            tactic={slotPickerTactic}
            slots={slots}
            onPick={handleEquipInSlot}
            onClose={() => setSlotPickerTactic(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {upgradeConfirmSlot != null && slots[upgradeConfirmSlot] && (
          <UpgradeConfirmModal
            key="upgrade-confirm"
            tactic={slots[upgradeConfirmSlot]}
            scrolls={scrolls}
            onConfirm={() => handleLevelUp(upgradeConfirmSlot)}
            onClose={() => setUpgradeConfirmSlot(null)}
            isPending={levelUpMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
