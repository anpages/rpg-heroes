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
import { TACTIC_SLOT_COUNT, TACTIC_SWAP_COST } from '../lib/gameConstants'
import { X, Coins, Lock, Sparkles } from 'lucide-react'

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
  return bonuses
    .filter(b => b.value)
    .map(b => `+${b.value} ${STAT_LABELS[b.stat] ?? b.stat}`)
    .join(', ')
}

function describeCombatEffect(fx) {
  if (!fx || !fx.effect) return null
  const parts = []
  // trigger
  if (fx.trigger === 'start_of_combat') parts.push('Al inicio del combate')
  else if (fx.trigger === 'passive') parts.push('Pasiva')
  else if (fx.trigger === 'hp_below_pct') parts.push(`Con HP < ${Math.round((fx.threshold ?? 0) * 100)}%`)
  else if (fx.trigger === 'round_n') parts.push(`En ronda ${fx.n}`)
  else if (fx.trigger === 'on_crit') parts.push('Al golpe crítico')
  else if (fx.trigger === 'on_dodge') parts.push('Al esquivar')
  // effect
  const e = fx.effect
  if (e === 'guaranteed_crit') parts.push('crítico garantizado')
  else if (e === 'damage_mult') parts.push(`daño ×${fx.value}`)
  else if (e === 'bonus_magic_damage') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% daño mágico`)
  else if (e === 'heal_pct') parts.push(`cura ${Math.round((fx.value ?? 0) * 100)}% HP`)
  else if (e === 'armor_pen_boost') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% penetración`)
  else if (e === 'double_attack') parts.push('ataque doble')
  else if (e === 'absorb_shield') parts.push(`escudo ${Math.round((fx.value ?? 0) * 100)}% HP`)
  else if (e === 'reduce_crit_damage') parts.push(`-${Math.round((fx.value ?? 0) * 100)}% daño crítico recibido`)
  else if (e === 'damage_reduction') parts.push(`-${Math.round((fx.value ?? 0) * 100)}% daño recibido`)
  else if (e === 'guaranteed_dodge') parts.push('esquiva garantizada')
  else if (e === 'damage_mult_next') parts.push(`siguiente golpe ×${fx.value}`)
  else if (e === 'counter_attack') parts.push(`${Math.round((fx.chance ?? 0) * 100)}% contraataque`)
  else if (e === 'dodge_boost') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% esquiva`)
  else if (e === 'enemy_debuff') parts.push(`-${Math.round((fx.value ?? 0) * 100)}% ${STAT_LABELS[fx.stat] ?? fx.stat} enemigo`)
  else if (e === 'all_stats_pct') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% todas las stats`)
  else if (e === 'stat_buff') parts.push(`+${Math.round((fx.value ?? 0) * 100)}% ${STAT_LABELS[fx.stat] ?? fx.stat}`)
  else if (e === 'mirror_stance') parts.push('copia postura enemiga')
  else if (e === 'stealth') parts.push('sigilo')
  else if (e === 'guaranteed_crit_next') parts.push('siguiente golpe: crítico garantizado')
  else if (e === 'first_hit_mult') parts.push(`primer golpe ×${fx.value}`)
  else if (e === 'pure_magic_burst') parts.push(`explosión mágica ${Math.round((fx.value ?? 0) * 100)}%`)
  else parts.push(e)
  if (fx.duration && fx.duration < 99) parts.push(`${fx.duration} turnos`)
  return parts.join(' · ')
}

/* ─── Sub-componentes ────────────────────────────────────────────────────────── */

/** Chip compacto para slot equipado — tap = desequipa al instante */
function SlotChip({ tactic, index: _index, onTap }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const bonuses = formatBonuses(cat)

  return (
    <motion.button
      className="flex flex-col gap-0.5 p-2 rounded-lg border bg-surface overflow-hidden cursor-pointer min-w-0 text-left"
      style={{ borderColor: rarColor }}
      onClick={() => onTap(tactic)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-base leading-none flex-shrink-0">{cat.icon}</span>
        <span className="text-[12px] font-semibold text-text truncate leading-tight flex-1">{cat.name}</span>
      </div>
      {bonuses && (
        <span className="text-[10px] text-text-2 truncate leading-tight">{bonuses}</span>
      )}
    </motion.button>
  )
}

function SlotEmpty({ index }) {
  return (
    <div className="flex items-center gap-1.5 p-2 rounded-lg border-2 border-dashed border-border bg-surface/40 select-none min-w-0">
      <Lock size={11} strokeWidth={1.5} className="text-text-3 opacity-40 flex-shrink-0" />
      <span className="text-[11px] text-text-3 opacity-50 truncate">Slot {index + 1}</span>
    </div>
  )
}

/** Card de colección — tap = equipa al instante */
function TacticCard({ tactic, onTap }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const catColor = CATEGORY_COLORS[cat.category] ?? '#6b7280'
  const bonuses = formatBonuses(cat)
  const effectDesc = describeCombatEffect(cat.combat_effect)

  return (
    <motion.button
      className="relative flex flex-col rounded-xl border bg-surface overflow-hidden text-left w-full"
      style={{ borderColor: `color-mix(in srgb,${rarColor} 50%,var(--border))` }}
      onClick={() => onTap(tactic)}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
    >
      <div className="h-[3px] w-full" style={{ background: rarColor }} />

      <div className="flex gap-2.5 p-3">
        <div
          className="w-10 h-10 flex items-center justify-center rounded-lg text-xl flex-shrink-0"
          style={{ background: `color-mix(in srgb,${rarColor} 10%,transparent)` }}
        >
          {cat.icon}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-text truncate">{cat.name}</span>

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

          {bonuses && (
            <span className="text-[11px] text-text-2 mt-0.5">{bonuses}</span>
          )}

          {effectDesc && (
            <span className="text-[10px] text-text-3 mt-0.5 leading-snug">{effectDesc}</span>
          )}
        </div>
      </div>
    </motion.button>
  )
}

/* ─── Slot picker: solo cuando todos los slots están llenos ─────────────────── */

function SlotPickerModal({ tactic, slots, onPick, onCancel }) {
  const cat = tactic.tactic_catalog
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center"
      onClick={onCancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden w-full sm:w-auto"
        style={{ maxWidth: 'min(380px, 100vw)' }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border">
          <div>
            <p className="text-[15px] font-bold text-text leading-none">Reemplazar slot</p>
            <p className="text-[12px] text-text-3 mt-1">
              Elige qué slot ocupará <span className="font-semibold" style={{ color: rarColor }}>{cat.name}</span>
            </p>
          </div>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3 transition-colors"
            onClick={onCancel}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border">
          <Coins size={13} strokeWidth={2} className="text-[#d97706]" />
          <span className="text-[12px] text-text-2">
            Cuesta <span className="font-bold text-[#d97706]">{TACTIC_SWAP_COST} oro</span>
          </span>
        </div>

        <div className="px-5 py-4 flex flex-col gap-2">
          {slots.map((slot, i) => {
            const slotCat = slot?.tactic_catalog
            return (
              <button
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/50 hover:bg-surface-2 transition-colors"
                onClick={() => onPick(i)}
              >
                <span className="text-[13px] font-bold text-text-3 w-5 text-center">{i + 1}</span>
                {slot ? (
                  <>
                    <span className="text-lg">{slotCat.icon}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-[12px] font-semibold text-text truncate block">{slotCat.name}</span>
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

  const [filter, setFilter] = useState('all')
  const [slotPickerTactic, setSlotPickerTactic] = useState(null)

  const slots = useMemo(() => buildSlots(tactics), [tactics])

  // Collection = only unequipped tactics
  const collection = useMemo(() => {
    if (!tactics) return []
    const unequipped = tactics.filter(t => t.slot_index == null)
    const sorted = [...unequipped].sort((a, b) => {
      const rarOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common']
      const ra = rarOrder.indexOf(a.tactic_catalog.rarity)
      const rb = rarOrder.indexOf(b.tactic_catalog.rarity)
      if (ra !== rb) return ra - rb
      return (a.tactic_catalog.name ?? '').localeCompare(b.tactic_catalog.name ?? '')
    })
    if (filter === 'all') return sorted
    return sorted.filter(t => t.tactic_catalog.category === filter)
  }, [tactics, filter])

  const tacticsKey = queryKeys.heroTactics(heroId)

  // ── Equip mutation — sin optimistic, solo invalidar ──
  const equipMutation = useMutation({
    mutationFn: ({ heroId: hid, tacticId, slotIndex }) =>
      apiPost('/api/tactic-equip', { heroId: hid, tacticId, slotIndex }),
    onSuccess: () => {
      setSlotPickerTactic(null)
      queryClient.invalidateQueries({ queryKey: tacticsKey })
    },
    onError: (err) => notify.error(err.message),
  })

  // ── Unequip mutation — sin optimistic, solo invalidar ──
  const unequipMutation = useMutation({
    mutationFn: ({ heroId: hid, tacticId }) =>
      apiPost('/api/tactic-equip', { heroId: hid, tacticId, slotIndex: null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tacticsKey }),
    onError: (err) => notify.error(err.message),
  })

  const busy = equipMutation.isPending || unequipMutation.isPending

  // ── Handlers: tap = acción directa, sin modales ──

  function handleTapEquipped(tactic) {
    if (busy) return
    unequipMutation.mutate({ heroId, tacticId: tactic.tactic_id })
  }

  function handleTapCollection(tactic) {
    if (busy) return
    const freeIdx = firstFreeSlot(slots)
    if (freeIdx !== -1) {
      equipMutation.mutate({ heroId, tacticId: tactic.tactic_id, slotIndex: freeIdx })
    } else {
      setSlotPickerTactic(tactic)
    }
  }

  function handleSlotPick(slotIndex) {
    if (!slotPickerTactic || busy) return
    equipMutation.mutate({ heroId, tacticId: slotPickerTactic.tactic_id, slotIndex })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-text-3 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sparkles size={18} strokeWidth={2} className="text-[#7c3aed]" />
          <h2 className="text-[17px] font-bold text-text">Tácticas</h2>
        </div>
        {resources && (
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
            <Coins size={14} strokeWidth={2} className="text-[#d97706]" />
            <span className="tabular-nums">{resources.gold?.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* ── Equipped slots — compact chips, 3+2 on mobile, tap = unequip ── */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-3">
          Build activa — {slots.filter(Boolean).length}/{TACTIC_SLOT_COUNT}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          <AnimatePresence mode="popLayout">
            {slots.map((slot, i) =>
              slot ? (
                <SlotChip key={slot.id} tactic={slot} index={i} onTap={handleTapEquipped} />
              ) : (
                <SlotEmpty key={`empty-${i}`} index={i} />
              ),
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Filter tabs ── */}
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

      {/* ── Collection: tap = equip ── */}
      {collection.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Sparkles size={28} strokeWidth={1.5} className="text-text-3 opacity-40" />
          <p className="text-[13px] text-text-3">
            {filter === 'all' ? 'Todas las tácticas están equipadas' : 'Sin tácticas en esta categoría'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <AnimatePresence mode="popLayout">
            {collection.map(t => (
              <TacticCard key={t.id} tactic={t} onTap={handleTapCollection} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Slot picker: solo cuando todos los slots están llenos ── */}
      <AnimatePresence>
        {slotPickerTactic && (
          <SlotPickerModal
            key="slot-picker"
            tactic={slotPickerTactic}
            slots={slots}
            onPick={handleSlotPick}
            onCancel={() => setSlotPickerTactic(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
