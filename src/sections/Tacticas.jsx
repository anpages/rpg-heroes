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
import { TACTIC_SLOT_COUNT, TACTIC_SWAP_COST, TACTIC_MAX_LEVEL } from '../lib/gameConstants'
import { X, Coins, Lock, Sparkles, ArrowUp } from 'lucide-react'

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
  { key: 'all',       label: 'Todas' },
  { key: 'offensive', label: 'Ofensivas' },
  { key: 'defensive', label: 'Defensivas' },
  { key: 'tactical',  label: 'Tácticas' },
  { key: 'utility',   label: 'Utilidad' },
]


/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function buildSlots(tactics) {
  const slots = Array.from({ length: TACTIC_SLOT_COUNT }, () => null)
  if (!tactics) return slots
  for (const t of tactics) {
    if (t.slot_index != null && t.slot_index >= 0 && t.slot_index < TACTIC_SLOT_COUNT) {
      slots[t.slot_index] = t
    }
  }
  return slots
}

function firstFreeSlot(slots) {
  return slots.findIndex(s => s === null)
}

const STAT_LABELS = {
  attack: 'ATQ', defense: 'DEF', max_hp: 'HP',
  strength: 'FUE', agility: 'AGI', intelligence: 'INT',
}

function formatBonuses(catalog) {
  const bonuses = catalog.stat_bonuses
  if (!Array.isArray(bonuses) || bonuses.length === 0) return ''
  return bonuses
    .filter(b => b.value)
    .map(b => `+${b.value} ${STAT_LABELS[b.stat] ?? b.stat}`)
    .join(', ')
}


/* ─── Sub-componentes ────────────────────────────────────────────────────────── */

function SlotPlaceholder({ index }) {
  return (
    <div className="flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 border-dashed border-border bg-surface/40 select-none">
      <Lock size={14} strokeWidth={1.5} className="text-text-3 opacity-40 mb-1" />
      <span className="text-[10px] text-text-3 font-medium opacity-60">Slot {index + 1}</span>
    </div>
  )
}

function EquippedSlotCard({ tactic, index, onUnequip }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const catColor = CATEGORY_COLORS[cat.category] ?? '#6b7280'

  return (
    <motion.button
      className="relative flex flex-col items-center justify-center w-full aspect-square rounded-xl border-2 bg-surface overflow-hidden cursor-pointer hover:brightness-110 transition-[filter]"
      style={{ borderColor: rarColor }}
      onClick={() => onUnequip(tactic)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      title={`${cat.name} — Clic para desequipar`}
    >
      {/* Slot badge */}
      <span
        className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-[1px] rounded"
        style={{
          color: rarColor,
          background: `color-mix(in srgb,${rarColor} 12%,transparent)`,
          border: `1px solid color-mix(in srgb,${rarColor} 30%,transparent)`,
        }}
      >
        {index + 1}
      </span>

      {/* Icon */}
      <span className="text-2xl leading-none mb-1">{cat.icon}</span>

      {/* Name */}
      <span className="text-[10px] font-semibold text-text text-center leading-tight px-1 line-clamp-2">{cat.name}</span>

      {/* Level */}
      <span className="text-[9px] font-bold mt-0.5" style={{ color: rarColor }}>Nv. {tactic.level ?? 1}</span>

      {/* Category dot */}
      <span
        className="absolute top-1 right-1 w-2 h-2 rounded-full"
        style={{ background: catColor }}
        title={CATEGORY_LABELS[cat.category]}
      />
    </motion.button>
  )
}

function TacticCard({ tactic, isEquipped, slotIndex, onSelect, onLevelUp, scrollQty }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const catColor = CATEGORY_COLORS[cat.category] ?? '#6b7280'
  const bonuses = formatBonuses(cat)
  const level = tactic.level ?? 1
  const canLevelUp = level < TACTIC_MAX_LEVEL && scrollQty > 0

  return (
    <motion.div
      className="relative flex flex-col rounded-xl border bg-surface overflow-hidden"
      style={{ borderColor: `color-mix(in srgb,${rarColor} 50%,var(--border))` }}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
    >
      {/* Rarity accent bar */}
      <div className="h-[3px] w-full" style={{ background: rarColor }} />

      <button
        className="flex gap-2.5 p-3 text-left cursor-pointer hover:brightness-105 transition-[filter] w-full"
        onClick={() => onSelect(tactic)}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 flex items-center justify-center rounded-lg text-xl flex-shrink-0"
          style={{ background: `color-mix(in srgb,${rarColor} 10%,transparent)` }}
        >
          {cat.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-text truncate">{cat.name}</span>
            {isEquipped && (
              <span
                className="text-[9px] font-bold px-1.5 py-[1px] rounded flex-shrink-0"
                style={{
                  color: rarColor,
                  background: `color-mix(in srgb,${rarColor} 12%,transparent)`,
                  border: `1px solid color-mix(in srgb,${rarColor} 30%,transparent)`,
                }}
              >
                Slot {slotIndex + 1}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold" style={{ color: rarColor }}>{RARITY_LABELS[cat.rarity]}</span>
            <span className="text-[10px] text-text-3">·</span>
            <span className="text-[10px] font-semibold" style={{ color: catColor }}>{CATEGORY_LABELS[cat.category]}</span>
            {cat.required_class && (
              <>
                <span className="text-[10px] text-text-3">·</span>
                <span className="text-[10px] font-semibold text-text-3 capitalize">{cat.required_class}</span>
              </>
            )}
          </div>

          <span className="text-[11px] font-bold text-text-2 mt-0.5" style={{ color: rarColor }}>
            Nv. {level}{level >= TACTIC_MAX_LEVEL ? ' (máx)' : ''}
          </span>

          {bonuses && (
            <span className="text-[11px] text-text-2 mt-0.5">{bonuses} <span className="text-text-3">/ nv.</span></span>
          )}

          {cat.description && (
            <p className="text-[11px] text-text-3 mt-1 leading-snug line-clamp-2">{cat.description}</p>
          )}
        </div>
      </button>

      {/* Level up button */}
      {level < TACTIC_MAX_LEVEL && (
        <div className="px-3 pb-2.5 pt-0">
          <button
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border-0 text-white transition-opacity disabled:opacity-40"
            style={{ background: canLevelUp ? '#7c3aed' : 'var(--text-3)' }}
            disabled={!canLevelUp}
            onClick={(e) => { e.stopPropagation(); onLevelUp(tactic) }}
          >
            <ArrowUp size={11} strokeWidth={2.5} />
            Subir nivel
          </button>
        </div>
      )}
    </motion.div>
  )
}

function SlotPickerModal({ tactic, slots, onPick, onCancel, isPending }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-5"
      onClick={onCancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-surface border border-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden"
        style={{ width: 'min(360px, 92vw)' }}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex flex-col gap-1.5">
            <p className="text-[15px] font-bold text-text leading-none">Reemplazar slot</p>
            <p className="text-[12px] text-text-3">
              Elige qué slot ocupará <span className="font-semibold" style={{ color: rarColor }}>{cat.name}</span>
            </p>
          </div>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3 transition-colors mt-0.5"
            onClick={onCancel}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Swap cost notice */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Coins size={13} strokeWidth={2} className="text-[#d97706]" />
          <span className="text-[12px] text-text-2">
            Reemplazar una táctica cuesta <span className="font-bold text-[#d97706]">{TACTIC_SWAP_COST} oro</span>
          </span>
        </div>

        {/* Slots */}
        <div className="px-5 py-4 flex flex-col gap-2">
          {slots.map((slot, i) => {
            const occupied = slot !== null
            const slotCat = occupied ? slot.tactic_catalog : null
            return (
              <button
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/50 hover:bg-surface-2 transition-colors disabled:opacity-40"
                onClick={() => onPick(i)}
                disabled={isPending}
              >
                <span className="text-[13px] font-bold text-text-3 w-6 text-center">{i + 1}</span>
                {occupied ? (
                  <>
                    <span className="text-lg">{slotCat.icon}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-[12px] font-semibold text-text truncate block">{slotCat.name}</span>
                      <span className="text-[10px] text-text-3">Nv. {slot.level ?? 1}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#dc2626]">Reemplazar</span>
                  </>
                ) : (
                  <span className="text-[12px] text-text-3 italic">Vacío</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Cancel */}
        <div className="flex gap-2 px-5 pb-5">
          <button className="btn btn--ghost btn--sm flex-1" onClick={onCancel} disabled={isPending}>
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

function UnequipConfirmModal({ tactic, onConfirm, onCancel, isPending }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6"
      onClick={onCancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 p-5"
        style={{ width: 'min(340px, 92vw)' }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-text">Desequipar táctica</span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3 hover:text-text hover:bg-surface-2 transition-colors"
            onClick={onCancel}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cat.icon}</span>
          <div>
            <span className="text-[13px] font-semibold block" style={{ color: rarColor }}>{cat.name}</span>
            <span className="text-[11px] text-text-3">Nv. {tactic.level ?? 1}</span>
          </div>
        </div>
        <p className="text-[13px] text-text-2">
          La táctica se moverá a tu colección y el slot quedará libre.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn btn--ghost btn--sm" onClick={onCancel} disabled={isPending}>Cancelar</button>
          <button className="btn btn--primary btn--sm" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Quitando…' : 'Desequipar'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}


function TacticLevelUpModal({ tactic, scrollQty, onConfirm, onCancel, isPending }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const level = tactic.level ?? 1
  const bonuses = formatBonuses(cat)

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6"
      onClick={onCancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 p-5"
        style={{ width: 'min(340px, 92vw)' }}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-text">Subir nivel</span>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3 hover:text-text hover:bg-surface-2 transition-colors"
            onClick={onCancel}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cat.icon}</span>
          <div>
            <span className="text-[13px] font-semibold block" style={{ color: rarColor }}>{cat.name}</span>
            <span className="text-[11px] text-text-3">
              Nv. {level} → <span className="font-bold text-[#7c3aed]">Nv. {level + 1}</span>
            </span>
          </div>
        </div>
        {bonuses && (
          <p className="text-[12px] text-text-2">
            Bonificación por nivel: <span className="font-semibold">{bonuses}</span>
          </p>
        )}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-2 border border-border">
          <span className="text-[14px]">📜</span>
          <span className="text-[12px] text-text-2">
            Pergamino Táctico: <span className={`font-bold ${scrollQty > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{scrollQty}</span> disponible{scrollQty !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn btn--ghost btn--sm" onClick={onCancel} disabled={isPending}>Cancelar</button>
          <button
            className="btn btn--sm text-white border-0"
            style={{ background: '#7c3aed' }}
            onClick={onConfirm}
            disabled={isPending || scrollQty <= 0}
          >
            {isPending ? 'Subiendo…' : 'Subir nivel'}
          </button>
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
  const { inventory: craftedItems } = useCraftedItems(userId)
  const queryClient = useQueryClient()

  const scrollQty = craftedItems?.tactic_scroll ?? 0

  const [filter, setFilter] = useState('all')
  const [slotPickerTactic, setSlotPickerTactic] = useState(null)
  const [unequipTarget, setUnequipTarget] = useState(null)
  const [levelUpTarget, setLevelUpTarget] = useState(null)

  // Build slot array
  const slots = useMemo(() => buildSlots(tactics), [tactics])

  // Equipped tactic IDs for quick lookup
  const equippedMap = useMemo(() => {
    const map = new Map()
    if (!tactics) return map
    for (const t of tactics) {
      if (t.slot_index != null) map.set(t.id, t.slot_index)
    }
    return map
  }, [tactics])

  // Filtered collection
  const collection = useMemo(() => {
    if (!tactics) return []
    const sorted = [...tactics].sort((a, b) => {
      const rarOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common']
      const ra = rarOrder.indexOf(a.tactic_catalog.rarity)
      const rb = rarOrder.indexOf(b.tactic_catalog.rarity)
      if (ra !== rb) return ra - rb
      return (a.tactic_catalog.name ?? '').localeCompare(b.tactic_catalog.name ?? '')
    })
    if (filter === 'all') return sorted
    return sorted.filter(t => t.tactic_catalog.category === filter)
  }, [tactics, filter])

  // ── Equip mutation ──
  const equipMutation = useMutation({
    mutationFn: ({ heroId, tacticId, slotIndex }) =>
      apiPost('/api/tactic-equip', { heroId, tacticId, slotIndex }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) })
      notify.success('Táctica equipada')
      setSlotPickerTactic(null)
    },
    onError: (err) => {
      notify.error(err.message)
    },
  })

  // ── Unequip mutation ──
  const unequipMutation = useMutation({
    mutationFn: ({ heroId, tacticId }) =>
      apiPost('/api/tactic-equip', { heroId, tacticId, slotIndex: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) })
      notify.success('Táctica desequipada')
      setUnequipTarget(null)
    },
    onError: (err) => {
      notify.error(err.message)
    },
  })

  // ── Level up mutation ──
  const levelUpMutation = useMutation({
    mutationFn: ({ heroId, tacticId }) =>
      apiPost('/api/tactic-levelup', { heroId, tacticId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) })
      notify.success('Táctica mejorada')
      setLevelUpTarget(null)
    },
    onError: (err) => {
      notify.error(err.message)
    },
  })

  // ── Handlers ──
  function handleSelectTactic(tactic) {
    // If already equipped, show unequip
    if (equippedMap.has(tactic.id)) {
      setUnequipTarget(tactic)
      return
    }

    const freeIdx = firstFreeSlot(slots)
    if (freeIdx !== -1) {
      // Free slot available — equip directly
      equipMutation.mutate({ heroId, tacticId: tactic.id, slotIndex: freeIdx })
    } else {
      // No free slot — show slot picker
      setSlotPickerTactic(tactic)
    }
  }

  function handleUnequipFromSlot(tactic) {
    setUnequipTarget(tactic)
  }

  function handleSlotPick(slotIndex) {
    if (!slotPickerTactic) return
    equipMutation.mutate({ heroId, tacticId: slotPickerTactic.id, slotIndex })
  }

  function confirmUnequip() {
    if (!unequipTarget) return
    unequipMutation.mutate({ heroId, tacticId: unequipTarget.id })
  }

  // ── Loading / empty ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-text-3 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sparkles size={18} strokeWidth={2} className="text-[#7c3aed]" />
          <h2 className="text-[17px] font-bold text-text">Tácticas</h2>
        </div>
        <div className="flex items-center gap-3">
          {scrollQty > 0 && (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2">
              📜 <span className="tabular-nums">{scrollQty}</span>
            </span>
          )}
          {resources && (
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
              <Coins size={14} strokeWidth={2} className="text-[#d97706]" />
              <span className="tabular-nums">{resources.gold?.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Build slots ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-3">
          Build activa — {slots.filter(Boolean).length}/{TACTIC_SLOT_COUNT} slots
        </p>
        <div className="grid grid-cols-5 gap-2">
          <AnimatePresence mode="popLayout">
            {slots.map((slot, i) =>
              slot ? (
                <EquippedSlotCard key={slot.id} tactic={slot} index={i} onUnequip={handleUnequipFromSlot} />
              ) : (
                <SlotPlaceholder key={`empty-${i}`} index={i} />
              ),
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {FILTER_TABS.map(tab => {
          const active = filter === tab.key
          return (
            <button
              key={tab.key}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap flex-shrink-0 ${
                active
                  ? 'bg-surface-2 border-border text-text'
                  : 'border-transparent text-text-3 hover:text-text-2 hover:bg-surface/60'
              }`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Collection grid ─────────────────────────────────────────────── */}
      {collection.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Sparkles size={28} strokeWidth={1.5} className="text-text-3 opacity-40" />
          <p className="text-[13px] text-text-3">
            {filter === 'all' ? 'Aún no tienes tácticas' : 'Sin tácticas en esta categoría'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <AnimatePresence mode="popLayout">
            {collection.map(t => (
              <TacticCard
                key={t.id}
                tactic={t}
                isEquipped={equippedMap.has(t.id)}
                slotIndex={equippedMap.get(t.id) ?? -1}
                onSelect={handleSelectTactic}
                onLevelUp={setLevelUpTarget}
                scrollQty={scrollQty}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {slotPickerTactic && (
          <SlotPickerModal
            key="slot-picker"
            tactic={slotPickerTactic}
            slots={slots}
            onPick={handleSlotPick}
            onCancel={() => setSlotPickerTactic(null)}
            isPending={equipMutation.isPending}
          />
        )}
        {unequipTarget && (
          <UnequipConfirmModal
            key="unequip-confirm"
            tactic={unequipTarget}
            onConfirm={confirmUnequip}
            onCancel={() => setUnequipTarget(null)}
            isPending={unequipMutation.isPending}
          />
        )}
        {levelUpTarget && (
          <TacticLevelUpModal
            key="levelup-confirm"
            tactic={levelUpTarget}
            scrollQty={scrollQty}
            onConfirm={() => levelUpMutation.mutate({ heroId, tacticId: levelUpTarget.id })}
            onCancel={() => setLevelUpTarget(null)}
            isPending={levelUpMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
