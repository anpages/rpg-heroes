import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHeroTactics } from '../hooks/useHeroTactics'
import { useResources } from '../hooks/useResources'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { TACTIC_SLOT_COUNT } from '../lib/gameConstants'
import { X, Coins, Sparkles, Plus } from 'lucide-react'

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

function formatBonuses(catalog) {
  const bonuses = catalog.stat_bonuses
  if (!Array.isArray(bonuses) || bonuses.length === 0) return ''
  return bonuses.filter(b => b.value).map(b => `+${b.value} ${STAT_LABELS[b.stat] ?? b.stat}`).join(', ')
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

/* ─── Slot card (vista principal, tamaño fijo) ───────────────────────────────── */

function SlotCard({ tactic, onTap }) {
  if (!tactic) {
    return (
      <button
        className="flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-2 p-3 sm:py-4 rounded-xl border-2 border-dashed border-border bg-surface/20 w-full text-left sm:text-center min-h-[60px] sm:min-h-[90px]"
        onClick={onTap}
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center flex-shrink-0">
          <Plus size={14} strokeWidth={2} className="text-text-3 opacity-40" />
        </div>
        <span className="text-[12px] text-text-3 opacity-40">Vacío</span>
      </button>
    )
  }

  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const bonuses = formatBonuses(cat)
  const effectDesc = describeCombatEffect(cat.combat_effect)

  return (
    <button
      className="flex sm:flex-col items-start sm:items-center gap-3 sm:gap-2 p-3 sm:py-3 rounded-xl border bg-surface w-full text-left sm:text-center min-h-[60px] sm:min-h-[90px]"
      style={{ borderColor: rarColor }}
      onClick={onTap}
    >
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg text-xl flex-shrink-0"
        style={{ background: `color-mix(in srgb,${rarColor} 14%,transparent)` }}
      >
        {cat.icon}
      </div>
      <div className="flex-1 sm:flex-none min-w-0 sm:w-full flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-text truncate block">{cat.name}</span>
        {bonuses && <span className="text-[10px] text-text-2 truncate block">{bonuses}</span>}
        {effectDesc && <span className="text-[10px] text-text-3 truncate block">{effectDesc}</span>}
      </div>
    </button>
  )
}

/* ─── Collection row (dentro del sheet) ─────────────────────────────────────── */

function CollectionRow({ tactic, onTap }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const catColor = CATEGORY_COLORS[cat.category] ?? '#6b7280'
  const bonuses = formatBonuses(cat)
  const effectDesc = describeCombatEffect(cat.combat_effect)

  return (
    <button
      className="flex items-center gap-3 p-3 rounded-xl border bg-surface w-full text-left"
      style={{ borderColor: `color-mix(in srgb,${rarColor} 35%,var(--border))` }}
      onClick={() => onTap(tactic)}
    >
      <div
        className="w-9 h-9 flex items-center justify-center rounded-lg text-lg flex-shrink-0"
        style={{ background: `color-mix(in srgb,${rarColor} 12%,transparent)` }}
      >
        {cat.icon}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-text truncate">{cat.name}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold" style={{ color: rarColor }}>{RARITY_LABELS[cat.rarity]}</span>
          <span className="text-[10px] text-text-3">·</span>
          <span className="text-[10px] font-semibold" style={{ color: catColor }}>{CATEGORY_LABELS[cat.category]}</span>
        </div>
        {bonuses && <span className="text-[11px] text-text-2">{bonuses}</span>}
        {effectDesc && <span className="text-[10px] text-text-3 leading-snug">{effectDesc}</span>}
      </div>
    </button>
  )
}

/* ─── Modal inventario ───────────────────────────────────────────────────────── */

function InventoryModal({ collection, onEquip, onClose }) {
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return collection
    return collection.filter(t => t.tactic_catalog.category === filter)
  }, [collection, filter])

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden w-full sm:w-[440px]"
        style={{ maxHeight: '80dvh' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <p className="text-[15px] font-bold text-text">Inventario de tácticas</p>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3"
            onClick={onClose}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3 pb-2 flex-shrink-0">
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'bg-surface-2 border-border text-text'
                    : 'border-transparent text-text-3 hover:text-text-2'
                }`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Lista */}
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
                <CollectionRow key={t.tactic_id} tactic={t} onTap={onEquip} />
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
  const queryClient = useQueryClient()

  const [inventoryOpen, setInventoryOpen] = useState(false)

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

  function handleSlotTap(slotIndex) {
    const slot = slots[slotIndex]
    if (slot) {
      unequipMutation.mutate({ heroId, tacticId: slot.tactic_id })
    } else {
      setInventoryOpen(true)
    }
  }

  function handleEquip(tactic) {
    const targetSlot = firstFreeSlot(slots)
    if (targetSlot === -1) return // todos llenos, no debería ocurrir (inventario solo muestra si hay hueco)
    equipMutation.mutate({ heroId, tacticId: tactic.tactic_id, slotIndex: targetSlot })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-text-3 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const equippedCount = slots.filter(Boolean).length

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sparkles size={18} strokeWidth={2} className="text-[#7c3aed]" />
          <h2 className="text-[17px] font-bold text-text">Tácticas</h2>
          <span className="text-[12px] text-text-3 font-medium">{equippedCount}/{TACTIC_SLOT_COUNT}</span>
        </div>
        {resources && (
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
            <Coins size={14} strokeWidth={2} className="text-[#d97706]" />
            <span className="tabular-nums">{resources.gold?.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 5 slots fijos — nunca cambian de tamaño */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {slots.map((slot, i) => (
          <SlotCard key={i} tactic={slot} onTap={() => handleSlotTap(i)} />
        ))}
      </div>

      {/* Modal inventario */}
      <AnimatePresence>
        {inventoryOpen && (
          <InventoryModal
            key="inventory"
            collection={collection}
            onEquip={handleEquip}
            onClose={() => setInventoryOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
