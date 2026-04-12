import { useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useResources } from '../hooks/useResources'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { INVENTORY_BASE_LIMIT, BAG_SLOTS_PER_UPGRADE, BAG_UPGRADE_COSTS, BAG_MAX_UPGRADES, CLASS_COLORS } from '../lib/gameConstants'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { ItemDetailModal } from '../components/ItemDetailModal'
import DismantleChoiceModal from '../components/DismantleChoiceModal'
import ItemComparisonModal from '../components/ItemComparisonModal'
import {
  Crown, Shirt, Hand, Move, Sword, Shield, Gem,
  Heart, Dumbbell, Wind, Brain, Backpack, Wrench, Trash2, X, Sparkles, ArrowUp,
  Coins, Layers, Info, Pickaxe, Axe, Scale,
} from 'lucide-react'

/* ─── Constantes ─────────────────────────────────────────────────────────────── */

const SLOT_META = {
  helmet:      { label: 'Casco',           Icon: Crown  },
  chest:       { label: 'Torso',           Icon: Shirt  },
  arms:        { label: 'Brazos',          Icon: Hand   },
  legs:        { label: 'Piernas',         Icon: Move   },
  main_hand:   { label: 'Arma Principal',  Icon: Sword  },
  off_hand:    { label: 'Mano Secundaria', Icon: Shield },
  accessory:   { label: 'Complemento',     Icon: Gem    },
  accessory_2: { label: 'Complemento 2',   Icon: Gem    },
}

const ALL_SLOTS = ['helmet', 'chest', 'arms', 'legs', 'main_hand', 'off_hand', 'accessory', 'accessory_2']

const RARITY_COLORS = {
  common:    '#6b7280',
  uncommon:  '#16a34a',
  rare:      '#2563eb',
  epic:      '#7c3aed',
  legendary: '#d97706',
}

const RARITY_LABELS = {
  common: 'Común', uncommon: 'Poco Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
}

const STAT_CONFIG = [
  { key: 'max_hp',       label: 'HP Máximo',     bonusKey: 'hp_bonus',           color: '#dc2626', Icon: Heart    },
  { key: 'attack',       label: 'Ataque',       bonusKey: 'attack_bonus',       color: '#d97706', Icon: Sword    },
  { key: 'defense',      label: 'Defensa',       bonusKey: 'defense_bonus',      color: '#6b7280', Icon: Shield   },
  { key: 'strength',     label: 'Fuerza',        bonusKey: 'strength_bonus',     color: '#dc2626', Icon: Dumbbell },
  { key: 'agility',      label: 'Agilidad',      bonusKey: 'agility_bonus',      color: '#2563eb', Icon: Wind     },
  { key: 'intelligence', label: 'Inteligencia',  bonusKey: 'intelligence_bonus', color: '#7c3aed', Icon: Brain    },
]

// Metadatos para el ItemComparisonModal — el key es el bonusKey del catálogo
const COMPARE_STAT_META = [
  { key: 'attack_bonus',       label: 'Ataque',       Icon: Sword    },
  { key: 'defense_bonus',      label: 'Defensa',      Icon: Shield   },
  { key: 'hp_bonus',           label: 'HP',           Icon: Heart    },
  { key: 'strength_bonus',     label: 'Fuerza',       Icon: Dumbbell },
  { key: 'agility_bonus',      label: 'Agilidad',     Icon: Wind     },
  { key: 'intelligence_bonus', label: 'Inteligencia', Icon: Brain    },
]


/* ─── Helpers ────────────────────────────────────────────────────────────────── */

// estimateRepairCost ya no se usa — las reparaciones consumen kits crafteados


/* ─── Sub-componentes ────────────────────────────────────────────────────────── */

function DurabilityBar({ current, max }) {
  const pct   = max > 0 ? Math.round((current / max) * 100) : 0
  const color = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  return (
    <div className="w-full h-[3px] bg-border rounded-full overflow-hidden mt-1.5">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function CostRow({ Icon: RowIcon, label, need, have, color }) {
  const ok = have >= need
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <RowIcon size={14} strokeWidth={2} style={{ color }} />
        <span className="text-[13px] text-text-2">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`text-[13px] font-bold tabular-nums ${ok ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{have}</span>
        <span className="text-[11px] text-text-3">/</span>
        <span className="text-[13px] font-semibold text-text-3 tabular-nums">{need}</span>
      </div>
    </div>
  )
}

const UPGRADE_STAT_KEYS = [
  { key: 'attack_bonus',       label: 'ATQ', Icon: Sword,    color: '#d97706' },
  { key: 'defense_bonus',      label: 'DEF', Icon: Shield,   color: '#6b7280' },
  { key: 'hp_bonus',           label: 'HP',  Icon: Heart,    color: '#dc2626' },
  { key: 'strength_bonus',     label: 'FUE', Icon: Dumbbell, color: '#dc2626' },
  { key: 'agility_bonus',      label: 'AGI', Icon: Wind,     color: '#2563eb' },
  { key: 'intelligence_bonus', label: 'INT', Icon: Brain,    color: '#7c3aed' },
]

function TierUpgradeModal({ item, resources: _resources, craftedItems, onConfirm, onCancel, isPending, errorMsg }) {
  const cat      = item.item_catalog
  const nextTier = cat.tier + 1
  const stoneId  = cat.tier === 1 ? 'forge_stone_t2' : 'forge_stone_t3'
  const stoneName = cat.tier === 1 ? 'Piedra de Forja T2' : 'Piedra de Forja T3'
  const stoneQty = craftedItems?.[stoneId] ?? 0
  const hasStone = stoneQty > 0

  // Fetch next tier catalog entry to show stat comparison
  const { data: nextCatalog } = useQuery({
    queryKey: ['nextTierCatalog', cat.slot, cat.rarity, nextTier, cat.is_two_handed, cat.required_class],
    queryFn: async () => {
      let q = supabase
        .from('item_catalog')
        .select('attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus, max_durability')
        .eq('slot', cat.slot)
        .eq('rarity', cat.rarity)
        .eq('tier', nextTier)

      if (cat.is_two_handed === true) {
        q = q.eq('is_two_handed', true)
      } else {
        q = q.or('is_two_handed.is.null,is_two_handed.eq.false')
      }

      if (cat.required_class) {
        q = q.eq('required_class', cat.required_class)
      } else {
        q = q.is('required_class', null)
      }

      const { data } = await q.maybeSingle()
      return data
    },
    staleTime: Infinity,
  })

  const statDiffs = nextCatalog
    ? UPGRADE_STAT_KEYS
        .map(s => ({ ...s, cur: cat[s.key] ?? 0, next: nextCatalog[s.key] ?? 0 }))
        .map(s => ({ ...s, diff: s.next - s.cur }))
        .filter(s => s.cur > 0 || s.next > 0)
    : []

  const canAfford = hasStone

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-5"
      onClick={onCancel}
    >
      <motion.div
        className="bg-surface border border-border rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden"
        style={{ width: 'min(360px, 92vw)' }}
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={   { opacity: 0, scale: 0.97, y: 6  }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-bold text-text leading-none">{cat.name}</p>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-text-3 bg-surface-2 border border-border px-2 py-0.5 rounded">T{cat.tier}</span>
              <ArrowUp size={13} strokeWidth={2.5} className="text-[#0f766e]" />
              <span
                className="text-[12px] font-bold px-2 py-0.5 rounded border"
                style={{ color: '#0f766e', background: 'color-mix(in srgb,#0f766e 10%,transparent)', borderColor: 'color-mix(in srgb,#0f766e 30%,transparent)' }}
              >
                T{nextTier}
              </span>
            </div>
          </div>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-3 transition-colors mt-0.5"
            onClick={onCancel}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Comparativa de stats */}
        {statDiffs.length > 0 && (
          <div className="px-5 py-4 border-b border-border flex flex-col gap-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-3">Mejora de stats</p>
            <div className="grid gap-1.5">
              {statDiffs.map(s => (
                <div key={s.key} className="flex items-center gap-2 text-[13px]">
                  <s.Icon size={13} strokeWidth={2} style={{ color: s.color }} className="shrink-0" />
                  <span className="text-text-3 w-8">{s.label}</span>
                  <span className="text-text-3 tabular-nums w-8 text-right">{s.cur}</span>
                  <ArrowUp size={11} strokeWidth={2.5} className="text-[#0f766e] shrink-0" />
                  <span className="font-bold text-text tabular-nums w-8">{s.next}</span>
                  {s.diff > 0 && (
                    <span className="text-[11px] font-bold text-[#0f766e] ml-auto">+{s.diff}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coste */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-3">Requiere</p>
          <p className="text-[13px] font-semibold" style={{ color: hasStone ? '#16a34a' : '#dc2626' }}>
            1× {stoneName} {hasStone ? `(tienes ${stoneQty})` : '— Craftéala en el Taller'}
          </p>
        </div>

        {/* Aviso */}
        <p className="text-[11px] text-text-3 italic px-5 pb-3">
          Durabilidad al 100% requerida · Esta mejora es irreversible
        </p>

        {/* Error inline */}
        {errorMsg && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,#dc2626_8%,transparent)] border border-[color-mix(in_srgb,#dc2626_25%,transparent)]">
            <p className="text-[12px] font-semibold text-[#dc2626]">{errorMsg}</p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2 px-5 pb-5">
          <button className="btn btn--ghost btn--sm flex-1" onClick={onCancel} disabled={isPending}>
            Cancelar
          </button>
          <button
            className="btn btn--primary btn--sm flex-1"
            onClick={onConfirm}
            disabled={isPending || !canAfford}
          >
            {isPending ? 'Mejorando…' : !canAfford ? 'Sin recursos' : 'Mejorar tier'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}

function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, canConfirm = true, disabledReason }) {
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
          <span className="text-[15px] font-bold text-text">{title}</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3 hover:text-text hover:bg-surface-2 transition-colors" onClick={onCancel}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="text-[13px] text-text-2 whitespace-pre-line">{body}</div>
        <div className="flex gap-2 justify-end items-center">
          {!canConfirm && disabledReason && (
            <span className="text-[11px] font-semibold text-[#dc2626] mr-auto">{disabledReason}</span>
          )}
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn--primary btn--sm disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

function EquipmentSlot({ slotKey, item, onUnequip, onRepair, onUpgradeTier, onViewDetail, repairLoading, upgradeLoading, isExploring, heroClass }) {
  const { label, Icon } = SLOT_META[slotKey]

  if (!item) {
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-border bg-surface/40 min-h-[64px] select-none">
        <div className="w-8 h-8 flex items-center justify-center text-text-3 flex-shrink-0 opacity-50">
          <Icon size={15} strokeWidth={1.5} />
        </div>
        <span className="text-[12px] text-text-3 font-medium">{label}</span>
      </div>
    )
  }

  const cat         = item.item_catalog
  const rarColor    = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const durPct      = cat.max_durability > 0 ? Math.round((item.current_durability / cat.max_durability) * 100) : 100
  const durColor    = durPct > 60 ? '#16a34a' : durPct > 30 ? '#d97706' : '#dc2626'
  const needsRepair = durPct < 100
  const canUpgrade  = cat.tier < 3 && durPct >= 100
  const isClassItem = cat.required_class && cat.required_class === heroClass
  const classColor  = CLASS_COLORS[cat.required_class]

  return (
    <div className="flex rounded-xl border border-border bg-surface w-full overflow-hidden"
      style={isClassItem ? { borderColor: `color-mix(in srgb,${classColor} 40%,var(--border))` } : undefined}>
      {isClassItem && <div className="w-1 flex-shrink-0" style={{ background: `color-mix(in srgb,${classColor} 60%,transparent)` }} />}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Info */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ color: rarColor }}>
          <Icon size={13} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-semibold truncate block" style={{ color: rarColor }}>{cat.name}</span>
          <span className="text-[11px] text-text-3 capitalize flex items-center gap-1.5">
            {label}
            {cat.is_two_handed && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-[1px] rounded"
                style={{
                  color: '#b45309',
                  background: 'color-mix(in srgb,#b45309 10%,transparent)',
                  border: '1px solid color-mix(in srgb,#b45309 30%,transparent)',
                }}
                title="Ocupa ambas manos"
              >
                2 manos
              </span>
            )}
          </span>
        </div>
        <span className="text-[11px] font-bold text-text-3 bg-surface-2 border border-border rounded px-1 flex-shrink-0">T{cat.tier}</span>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center justify-end gap-2 mb-1">
          <span className="text-[11px] font-bold flex-shrink-0" style={{ color: durColor }}>{durPct}%</span>
        </div>
        <DurabilityBar current={item.current_durability} max={cat.max_durability} />
      </div>

      {/* Footer de acciones */}
      <div className="flex border-t border-border divide-x divide-border">
        <button
          className="flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-semibold text-text-3 hover:text-text-2 hover:bg-surface-2 transition-colors"
          onClick={() => onViewDetail(item)}
        >
          <Info size={11} strokeWidth={2} /> + Info
        </button>
        {needsRepair && (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#d97706] hover:bg-[color-mix(in_srgb,#d97706_6%,transparent)] transition-colors disabled:opacity-40"
            onClick={() => onRepair(item)}
            disabled={repairLoading || isExploring}
          >
            <Wrench size={12} strokeWidth={2} /> Reparar
          </button>
        )}
        {canUpgrade && (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#0f766e] hover:bg-[color-mix(in_srgb,#0f766e_6%,transparent)] transition-colors disabled:opacity-40"
            onClick={() => onUpgradeTier(item)}
            disabled={upgradeLoading || isExploring}
          >
            <ArrowUp size={12} strokeWidth={2.5} /> T{cat.tier}→T{cat.tier + 1}
          </button>
        )}
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-text-3 hover:text-[#dc2626] hover:bg-[color-mix(in_srgb,#dc2626_5%,transparent)] transition-colors disabled:opacity-40"
          onClick={() => onUnequip(item.id)}
          disabled={isExploring}
        >
          <X size={12} strokeWidth={2.5} /> Quitar
        </button>
      </div>
      </div>
    </div>
  )
}

function StatRow({ label, color, Icon: StatIcon, base, equipBonus, penalty = 0 }) {
  const total  = base + equipBonus - penalty
  const maxVal = Math.max(30, (base + equipBonus) * 1.6)
  const basePct  = Math.min(100, (base       / maxVal) * 100)
  const eqPct    = Math.min(100 - basePct, (Math.max(0, equipBonus) / maxVal) * 100)

  return (
    <div className="flex flex-col gap-1">
      {/* Mobile: compact row */}
      <div className="flex items-center justify-between sm:hidden">
        <div className="flex items-center gap-1.5">
          <StatIcon size={12} strokeWidth={2} style={{ color }} />
          <span className="text-[12px] font-semibold text-text-2">{label}</span>
        </div>
        <span className="text-[14px] font-bold text-text">{total}</span>
      </div>

      {/* Desktop: full breakdown with bars */}
      <div className="hidden sm:flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <StatIcon size={11} strokeWidth={2} style={{ color }} />
            <span className="text-[11px] font-semibold text-text-2">{label}</span>
          </div>
          <span className="text-[13px] font-bold text-text">{total}</span>
        </div>
        <div className="h-[5px] bg-surface-2 border border-border rounded-full overflow-hidden flex">
          <div className="h-full" style={{ width: `${basePct}%`, background: color, opacity: 0.4 }} />
          <div className="h-full" style={{ width: `${eqPct}%`,   background: color, opacity: 0.75 }} />
        </div>
      </div>
    </div>
  )
}


/* ─── Componente principal ───────────────────────────────────────────────────── */

export default function Equipo() {
  const userId      = useAppStore(s => s.userId)
  const heroId      = useHeroId()
  const { hero }    = useHero(heroId)
  const isExploring = hero?.status === 'exploring'
  const { items }   = useInventory(heroId)
  const { resources } = useResources(userId)
  const { inventory: craftedItems } = useCraftedItems(userId)
  const queryClient    = useQueryClient()
  const [confirm, setConfirm] = useState(null)
  const [dismantleTarget, setDismantleTarget] = useState(null)
  const [tierUpgradeTarget, setTierUpgradeTarget] = useState(null)
  const [itemDetail, setItemDetail] = useState(null)
  const [compareTarget, setCompareTarget] = useState(null)
  const equipPending   = useRef(0)  // contador de mutaciones equip en vuelo

  // Equip / unequip — optimistic desde el cache actual, invalida solo cuando
  // todas las mutaciones en vuelo hayan terminado (evita el caos visual)
  const equipMutation = useMutation({
    mutationFn: ({ endpoint, body }) => apiPost(endpoint, body),
    onMutate: async ({ body }) => {
      equipPending.current++
      const key = queryKeys.inventory(heroId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      const current  = previous ?? []
      const { itemId, equip } = body

      if (equip) {
        const item = current.find(i => i.id === itemId)
        if (item) {
          const targetSlot = item.item_catalog.slot
          queryClient.setQueryData(key, current.map(i => {
            if (i.id === itemId) return { ...i, equipped_slot: targetSlot }
            if (i.equipped_slot === targetSlot) return { ...i, equipped_slot: null }
            // 2 manos → desequipa off_hand
            if (item.item_catalog.is_two_handed && i.equipped_slot === 'off_hand') return { ...i, equipped_slot: null }
            // Equipar off_hand → desequipa arma de 2 manos en main_hand
            if (targetSlot === 'off_hand' && i.equipped_slot === 'main_hand' && i.item_catalog?.is_two_handed) return { ...i, equipped_slot: null }
            return i
          }))
        }
      } else {
        queryClient.setQueryData(key, current.map(i =>
          i.id === itemId ? { ...i, equipped_slot: null } : i
        ))
      }
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKeys.inventory(heroId), context.previous)
      notify.error(err.message)
    },
    onSettled: () => {
      equipPending.current--
      // Solo invalida cuando no quedan mutaciones pendientes
      if (equipPending.current === 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      }
    },
  })

  // Repair / dismantle — bloquea solo su botón de confirmación
  const actionMutation = useMutation({
    mutationFn: ({ endpoint, body }) => apiPost(endpoint, body),
    onMutate: async ({ body }) => {
      if (!body.itemId) return
      const key = queryKeys.inventory(heroId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      if (body._dismantle) {
        queryClient.setQueryData(key, (previous ?? []).filter(i => i.id !== body.itemId))
      }
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKeys.inventory(heroId), context.previous)
      notify.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
  })

  const tierUpgradeMutation = useMutation({
    mutationFn: ({ inventoryItemId }) => apiPost('/api/item-upgrade-tier', { heroId, inventoryItemId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      setTierUpgradeTarget(null)
      notify.success(`Ítem mejorado a ${data.newItemName ?? `T${data.newTier}`}`)
    },
    // El error se muestra inline en TierUpgradeModal, no como toast
  })

  const equippedBySlot = useMemo(() => {
    if (!items) return {}
    return Object.fromEntries(
      items.filter(i => i.equipped_slot).map(i => [i.equipped_slot, i])
    )
  }, [items])

  const unequipped = useMemo(() => (items ?? []).filter(i => !i.equipped_slot), [items])

  // Bag limit dinámico
  const bagExtraSlots = resources?.bag_extra_slots ?? 0
  const bagLimit      = INVENTORY_BASE_LIMIT + bagExtraSlots * BAG_SLOTS_PER_UPGRADE
  const canUpgradeBag = bagExtraSlots < BAG_MAX_UPGRADES
  const nextBagCost   = canUpgradeBag ? BAG_UPGRADE_COSTS[bagExtraSlots] : null

  const bagUpgradeMutation = useMutation({
    mutationFn: () => apiPost('/api/bag-upgrade', {}),
    onSuccess: () => {
      notify.success(`Mochila ampliada a ${bagLimit + BAG_SLOTS_PER_UPGRADE} slots`)
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
    onError: (err) => notify.error(err.message),
  })

  const { equipBonus, weightPenalty } = useMemo(() => {
    const eq = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0, max_hp: 0 }
    let totalWeight = 0
    ;(items ?? []).filter(i => i.equipped_slot && i.current_durability > 0).forEach(i => {
      const c = i.item_catalog
      eq.attack       += c.attack_bonus       ?? 0
      eq.defense      += c.defense_bonus      ?? 0
      eq.strength     += c.strength_bonus     ?? 0
      eq.agility      += c.agility_bonus      ?? 0
      eq.intelligence += c.intelligence_bonus ?? 0
      eq.max_hp       += c.hp_bonus           ?? 0
      totalWeight     += c.weight             ?? 0
    })
    const weightPenalty = Math.floor(totalWeight / 4)
    return { equipBonus: eq, weightPenalty }
  }, [items])

  const damagedEquipped = useMemo(() =>
    (items ?? []).filter(i => i.equipped_slot && i.current_durability < i.item_catalog.max_durability),
    [items]
  )

  if (!hero) {
    return (
      <div className="flex items-center justify-center h-40 text-text-3 text-[13px]">
        Selecciona un héroe
      </div>
    )
  }

  function handleEquip(itemId) {
    equipMutation.mutate({ endpoint: '/api/item-equip', body: { itemId, equip: true } })
  }

  function handleUnequip(itemId) {
    equipMutation.mutate({ endpoint: '/api/item-equip', body: { itemId, equip: false } })
  }

  function handleRepair(item) {
    const kits = craftedItems?.repair_kit ?? 0
    const hasKit = kits > 0

    setConfirm({
      title: `Reparar ${item.item_catalog.name}`,
      body: hasKit
        ? `Usar 1 Kit de Reparación (tienes ${kits})`
        : 'No tienes Kits de Reparación. Craftéalos en el Taller.',
      confirmLabel: 'Reparar',
      canConfirm: hasKit,
      disabledReason: hasKit ? null : 'Sin kits de reparación',
      onConfirm: () => {
        setConfirm(null)
        actionMutation.mutate({ endpoint: '/api/item-repair', body: { itemId: item.id } })
      },
    })
  }

  function handleRepairAll() {
    const kits = craftedItems?.repair_kit_full ?? 0
    const hasKit = kits > 0

    const body = (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 text-[12px] text-text-3">
          {damagedEquipped.map(i => (
            <div key={i.id} className="flex justify-between gap-3">
              <span className="truncate">{i.item_catalog.name}</span>
              <span className="font-medium text-text-2 flex-shrink-0">
                {i.current_durability}/{i.item_catalog.max_durability}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[13px] font-semibold text-text-2 pt-2 border-t border-border">
          {hasKit
            ? `Usar 1 Kit de Reparación Completo (tienes ${kits})`
            : 'No tienes Kits de Reparación Completo. Craftéalos en el Taller.'}
        </p>
      </div>
    )

    setConfirm({
      title: 'Reparar todo el equipo',
      body,
      confirmLabel: 'Reparar todo',
      canConfirm: hasKit,
      disabledReason: hasKit ? null : 'Sin kits de reparación completo',
      onConfirm: () => {
        setConfirm(null)
        actionMutation.mutate({ endpoint: '/api/item-repair-all', body: { heroId } })
      },
    })
  }

  function handleUpgradeTier(item) {
    tierUpgradeMutation.reset()
    setTierUpgradeTarget(item)
  }

  function handleDismantle(item) {
    setDismantleTarget(item)
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">

        {/* Stats */}
        <div className="flex flex-col gap-2 order-1 lg:order-2">
          <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Estadísticas</p>

          <div className="flex items-center justify-around p-3 rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)] sm:hidden">
            {STAT_CONFIG.map(({ key, color, Icon }) => {
              const pen   = key === 'agility' ? weightPenalty : 0
              const total = (hero[key] ?? 0) + (equipBonus[key] ?? 0) - pen
              return (
                <div key={key} className="flex flex-col items-center gap-0.5 py-1">
                  <Icon size={13} strokeWidth={2} style={{ color }} />
                  <span className="text-[14px] font-black text-text">{total}</span>
                </div>
              )
            })}
          </div>

          <div className="hidden sm:flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
            {STAT_CONFIG.map(({ key, label, color, Icon }) => (
              <StatRow key={key} label={label} color={color} Icon={Icon}
                base={hero[key] ?? 0} equipBonus={equipBonus[key] ?? 0}
                penalty={key === 'agility' ? weightPenalty : 0}
              />
            ))}
          </div>
        </div>

        {/* Equipment slots */}
        <div className="flex flex-col gap-2 order-2 lg:order-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Equipamiento</p>
            {damagedEquipped.length > 0 && (
              <button
                className="btn btn--sm flex items-center gap-1.5 disabled:opacity-40"
                style={{ fontSize: '11px', padding: '3px 10px', height: '24px', minHeight: 'unset', background: '#d97706', color: '#fff', borderColor: 'transparent' }}
                onClick={handleRepairAll}
                disabled={actionMutation.isPending || isExploring}
                title={isExploring ? 'No disponible durante expedición' : undefined}
              >
                <Wrench size={11} strokeWidth={2.5} />
                Reparar todo ({damagedEquipped.length})
              </button>
            )}
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_SLOTS.map(slot => (
                <EquipmentSlot
                  key={slot}
                  slotKey={slot}
                  item={equippedBySlot[slot] ?? null}
                  onUnequip={handleUnequip}
                  onRepair={handleRepair}
                  onUpgradeTier={handleUpgradeTier}
                  onViewDetail={setItemDetail}
                  repairLoading={actionMutation.isPending}
                  upgradeLoading={tierUpgradeMutation.isPending}
                  isExploring={isExploring}
                  heroClass={hero?.class}
                />
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Inventory */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Backpack size={13} strokeWidth={2} className="text-text-3" />
            <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Mochila</p>
            <span className="text-[11px] font-semibold text-text-2 tabular-nums">{unequipped.length} / {bagLimit}</span>
          </div>
          {canUpgradeBag && (
            <button
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#d97706] bg-[color-mix(in_srgb,#d97706_10%,var(--surface))] border border-[color-mix(in_srgb,#d97706_30%,var(--border))] rounded-full px-2.5 py-1 hover:bg-[color-mix(in_srgb,#d97706_18%,var(--surface))] transition-colors disabled:opacity-50"
              onClick={() => setConfirm({
                title: 'Ampliar mochila',
                body: `¿Ampliar la mochila de ${bagLimit} a ${bagLimit + BAG_SLOTS_PER_UPGRADE} slots por ${nextBagCost} oro?`,
                confirmLabel: 'Ampliar',
                onConfirm: () => { setConfirm(null); bagUpgradeMutation.mutate() },
              })}
              disabled={bagUpgradeMutation.isPending || (resources?.gold ?? 0) < nextBagCost}
              title={`Ampliar a ${bagLimit + BAG_SLOTS_PER_UPGRADE} slots por ${nextBagCost} oro`}
            >
              <ArrowUp size={11} strokeWidth={2.5} />
              <Coins size={11} strokeWidth={2} />
              {nextBagCost}
            </button>
          )}
        </div>

        {unequipped.length === 0 ? (
          <div className="flex items-center justify-center gap-2 h-20 text-[13px] text-text-3 border border-dashed border-border rounded-xl bg-surface">
            <Backpack size={14} strokeWidth={1.8} />
            Mochila vacía
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {unequipped.map(item => {
                const cat      = item.item_catalog
                const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
                const durPct   = cat.max_durability > 0 ? Math.round((item.current_durability / cat.max_durability) * 100) : 100
                const canEquip = durPct > 0
                const isClassItem = cat.required_class && cat.required_class === hero?.class
                const classColor  = CLASS_COLORS[cat.required_class]
                // El botón "Comparar" solo aparece si hay algo equipado del mismo slot.
                // Si no hay rival que comparar, la acción no aporta nada.
                const rival = equippedBySlot[cat.slot] ?? null
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-surface-2 overflow-hidden flex"
                    style={isClassItem ? { borderColor: `color-mix(in srgb,${classColor} 40%,var(--border))` } : undefined}>
                    {isClassItem && <div className="w-1 flex-shrink-0" style={{ background: `color-mix(in srgb,${classColor} 60%,transparent)` }} />}
                    <div className="flex-1 min-w-0 flex flex-col">
                    {/* Info */}
                    <div className="px-3 pt-3 pb-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] font-semibold truncate" style={{ color: rarColor }}>{cat.name}</span>
                        <span className="text-[11px] font-bold text-text-3 bg-surface border border-border rounded px-1 flex-shrink-0">T{cat.tier}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium">
                        <span style={{ color: rarColor }}>{RARITY_LABELS[cat.rarity] ?? cat.rarity}</span>
                        <span className="text-text-3">·</span>
                        <span className="text-text-3">{SLOT_META[cat.slot]?.label ?? cat.slot}</span>
                      </div>
                      <DurabilityBar current={item.current_durability} max={cat.max_durability} />
                    </div>
                    {/* Footer */}
                    <div className="flex border-t border-border divide-x divide-border">
                      <button
                        className="flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-semibold text-text-3 hover:text-text-2 hover:bg-surface-2 transition-colors"
                        onClick={() => setItemDetail(item)}
                      >
                        <Info size={11} strokeWidth={2} /> + Info
                      </button>
                      {rival && (
                        <button
                          type="button"
                          className="flex items-center justify-center gap-1 px-2.5 py-2 text-[11px] font-semibold text-text-3 hover:text-[var(--blue-600)] hover:bg-[color-mix(in_srgb,var(--blue-500)_6%,transparent)] transition-colors"
                          onClick={() => setCompareTarget({ item, rival })}
                          title={`Comparar con ${rival.item_catalog?.name ?? 'equipado'}`}
                        >
                          <Scale size={11} strokeWidth={2} /> vs
                        </button>
                      )}
                      <button
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40
                          ${canEquip
                            ? 'text-[var(--blue-600)] hover:bg-[color-mix(in_srgb,var(--blue-500)_6%,transparent)]'
                            : 'text-text-3 cursor-not-allowed'
                          }`}
                        onClick={() => canEquip && !isExploring && handleEquip(item.id)}
                        disabled={!canEquip || isExploring}
                        title={canEquip ? undefined : 'Repara el ítem antes de equiparlo'}
                      >
                        Equipar
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-text-3 hover:text-[#dc2626] hover:bg-[color-mix(in_srgb,#dc2626_5%,transparent)] transition-colors disabled:opacity-40"
                        onClick={() => handleDismantle(item)}
                        disabled={actionMutation.isPending}
                      >
                        <Trash2 size={12} strokeWidth={2} /> Desmantelar
                      </button>
                    </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {compareTarget && (() => {
        const { item: candidate, rival } = compareTarget
        const cat = candidate.item_catalog
        const diffs = COMPARE_STAT_META
          .map(s => ({
            key:       s.key,
            label:     s.label,
            Icon:      s.Icon,
            candidate: candidate.item_catalog?.[s.key] ?? 0,
            equipped:  rival.item_catalog?.[s.key] ?? 0,
          }))
          .filter(d => d.candidate !== 0 || d.equipped !== 0)
          .map(d => ({ ...d, diff: d.candidate - d.equipped }))
        const totalDiff = diffs.reduce((a, d) => a + d.diff, 0)
        return (
          <ItemComparisonModal
            item={{ name: cat.name, rarity: cat.rarity, tier: cat.tier }}
            isNewSlot={false}
            equipped={rival}
            diffs={diffs}
            totalDiff={totalDiff}
            slotLabel={SLOT_META[cat.slot]?.label ?? cat.slot}
            candidateLabel="Mochila"
            onClose={() => setCompareTarget(null)}
            onEquip={() => {
              handleEquip(candidate.id)
              setCompareTarget(null)
            }}
            equipLabel="Equipar este"
            equipDisabled={
              isExploring ||
              (candidate.current_durability <= 0)
            }
            equipDisabledReason={
              isExploring ? 'Héroe en expedición'
              : candidate.current_durability <= 0 ? 'Repara el ítem antes de equiparlo'
              : undefined
            }
          />
        )
      })()}
      </AnimatePresence>

      <AnimatePresence>
        {itemDetail && (
          <ItemDetailModal
            item={itemDetail}
            onClose={() => setItemDetail(null)}
            heroClass={hero?.class}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            title={confirm.title}
            body={confirm.body}
            confirmLabel={confirm.confirmLabel}
            canConfirm={confirm.canConfirm}
            disabledReason={confirm.disabledReason}
            onConfirm={confirm.onConfirm}
            onCancel={() => setConfirm(null)}
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
              actionMutation.mutate({ endpoint: '/api/item-dismantle', body: { itemId: item.id, _dismantle: true } })
            }}
            onTransmute={() => {
              const item = dismantleTarget
              setDismantleTarget(null)
              actionMutation.mutate({ endpoint: '/api/item-transmute', body: { itemId: item.id, _dismantle: true } })
            }}
            onCancel={() => setDismantleTarget(null)}
          />
        )}
      </AnimatePresence>

      {tierUpgradeTarget && (
        <TierUpgradeModal
          item={tierUpgradeTarget}
          resources={resources}
          craftedItems={craftedItems}
          isPending={tierUpgradeMutation.isPending}
          errorMsg={tierUpgradeMutation.error?.message ?? null}
          onConfirm={() => tierUpgradeMutation.mutate({ inventoryItemId: tierUpgradeTarget.id })}
          onCancel={() => { tierUpgradeMutation.reset(); setTierUpgradeTarget(null) }}
        />
      )}

    </div>
  )
}
