import { useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useHeroCards } from '../hooks/useHeroCards'
import { useHeroRunes } from '../hooks/useHeroRunes'
import { useBuildings } from '../hooks/useBuildings'
import { useResources } from '../hooks/useResources'
import { interpolateHp } from '../lib/hpInterpolation'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { REPAIR_COST_TABLE, DISMANTLE_MANA_TABLE, BASE_RUNE_SLOTS, ITEM_TIER_UPGRADE_COST } from '../lib/gameConstants'
import { ItemDetailModal } from '../components/ItemDetailModal'
import {
  Crown, Shirt, Hand, Move, Sword, Shield, Gem,
  Heart, Dumbbell, Wind, Brain, Backpack, Wrench, Trash2, X, Package, Sparkles, ArrowUp,
  Coins, Layers, Info,
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
  { key: 'attack',       label: 'Ataque',       bonusKey: 'attack_bonus',       color: '#d97706', Icon: Sword    },
  { key: 'defense',      label: 'Defensa',       bonusKey: 'defense_bonus',      color: '#6b7280', Icon: Shield   },
  { key: 'strength',     label: 'Fuerza',        bonusKey: 'strength_bonus',     color: '#dc2626', Icon: Dumbbell },
  { key: 'agility',      label: 'Agilidad',      bonusKey: 'agility_bonus',      color: '#2563eb', Icon: Wind     },
  { key: 'intelligence', label: 'Inteligencia',  bonusKey: 'intelligence_bonus', color: '#7c3aed', Icon: Brain    },
  { key: 'max_hp',       label: 'HP Máximo',     bonusKey: 'hp_bonus',           color: '#dc2626', Icon: Heart    },
]


/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function estimateRepairCost(item) {
  const catalog = item.item_catalog
  const missing = catalog.max_durability - item.current_durability
  const costs   = REPAIR_COST_TABLE[catalog.rarity] ?? REPAIR_COST_TABLE.common
  return {
    gold: Math.ceil(missing * costs.gold),
    mana: Math.ceil(missing * costs.mana),
  }
}

function estimateDismantleMana(item) {
  const base = DISMANTLE_MANA_TABLE[item.item_catalog.rarity] ?? DISMANTLE_MANA_TABLE.common
  return base * (item.item_catalog.tier ?? 1)
}

function mainStatForSlot(slotKey, cat) {
  if (slotKey === 'main_hand' || slotKey === 'off_hand') {
    if (cat.attack_bonus > 0)  return { label: 'Atq', value: cat.attack_bonus,  color: '#d97706' }
    if (cat.defense_bonus > 0) return { label: 'Def', value: cat.defense_bonus, color: '#6b7280' }
  }
  if (cat.defense_bonus > 0) return { label: 'Def', value: cat.defense_bonus, color: '#6b7280' }
  if (cat.attack_bonus  > 0) return { label: 'Atq', value: cat.attack_bonus,  color: '#d97706' }
  if (cat.hp_bonus      > 0) return { label: 'HP',  value: cat.hp_bonus,      color: '#dc2626' }
  return null
}

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

function TierUpgradeModal({ item, resources, onConfirm, onCancel, isPending, errorMsg }) {
  const cat      = item.item_catalog
  const cost     = ITEM_TIER_UPGRADE_COST[cat.tier] ?? {}
  const nextTier = cat.tier + 1

  const canAffordGold      = (resources?.gold      ?? 0) >= (cost.gold      ?? 0)
  const canAffordFragments = (resources?.fragments ?? 0) >= (cost.fragments ?? 0)
  const canAffordEssence   = (resources?.essence   ?? 0) >= (cost.essence   ?? 0)
  const canAfford          = canAffordGold && canAffordFragments && canAffordEssence

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

        {/* Costes */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-3">Coste</p>
          <div className="flex flex-col gap-2.5">
            {(cost.gold      ?? 0) > 0 && <CostRow Icon={Coins}    label="Oro"         need={cost.gold}      have={resources?.gold      ?? 0} color="#d97706" />}
            {(cost.fragments ?? 0) > 0 && <CostRow Icon={Layers}   label="Fragmentos"  need={cost.fragments} have={resources?.fragments ?? 0} color="#b45309" />}
            {(cost.essence   ?? 0) > 0 && <CostRow Icon={Sparkles} label="Esencia"     need={cost.essence}   have={resources?.essence   ?? 0} color="#7c3aed" />}
          </div>
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

function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6" onClick={onCancel}>
      <div
        className="bg-bg border border-border-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 p-5"
        style={{ width: 'min(340px, 92vw)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-text">{title}</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3 hover:text-text hover:bg-surface-2 transition-colors" onClick={onCancel}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <p className="text-[13px] text-text-2">{body}</p>
        <div className="flex gap-2 justify-end">
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--primary btn--sm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function EquipmentSlot({ slotKey, item, onUnequip, onRepair, onUpgradeTier, onViewDetail, repairLoading, upgradeLoading }) {
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
  const mainStat    = mainStatForSlot(slotKey, cat)
  const rarColor    = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const durPct      = cat.max_durability > 0 ? Math.round((item.current_durability / cat.max_durability) * 100) : 100
  const needsRepair = durPct < 100
  const canUpgrade  = cat.tier < 3 && durPct >= 100
  const upgradeCost = ITEM_TIER_UPGRADE_COST[cat.tier]

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface w-full overflow-hidden">
      {/* Info */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ color: rarColor }}>
          <Icon size={13} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold truncate block" style={{ color: rarColor }}>{cat.name}</span>
          <span className="text-[10px] text-text-3 capitalize">{label}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {mainStat && <span className="text-[11px] font-bold" style={{ color: mainStat.color }}>+{mainStat.value}</span>}
          <span className="text-[10px] font-bold text-text-3 bg-surface-2 border border-border rounded px-1">T{cat.tier}</span>
        </div>
      </div>

      <div className="px-3 pb-2">
        <DurabilityBar current={item.current_durability} max={cat.max_durability} />
      </div>

      {/* Footer de acciones */}
      <div className="flex border-t border-border divide-x divide-border">
        <button
          className="flex items-center justify-center px-3 py-2 text-text-3 hover:text-text-2 hover:bg-surface-2 transition-colors"
          onClick={() => onViewDetail(item)}
          title="Ver detalles"
        >
          <Info size={13} strokeWidth={2} />
        </button>
        {needsRepair && (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#d97706] hover:bg-[color-mix(in_srgb,#d97706_6%,transparent)] transition-colors disabled:opacity-40"
            onClick={() => onRepair(item)}
            disabled={repairLoading}
          >
            <Wrench size={12} strokeWidth={2} /> Reparar
          </button>
        )}
        {canUpgrade && (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#0f766e] hover:bg-[color-mix(in_srgb,#0f766e_6%,transparent)] transition-colors disabled:opacity-40"
            onClick={() => onUpgradeTier(item)}
            disabled={upgradeLoading}
          >
            <ArrowUp size={12} strokeWidth={2.5} /> T{cat.tier}→T{cat.tier + 1}
          </button>
        )}
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-text-3 hover:text-[#dc2626] hover:bg-[color-mix(in_srgb,#dc2626_5%,transparent)] transition-colors"
          onClick={() => onUnequip(item.id)}
        >
          <X size={12} strokeWidth={2.5} /> Quitar
        </button>
      </div>
    </div>
  )
}

function StatRow({ label, color, Icon: StatIcon, base, equipBonus, cardBonus }) {
  const total  = base + equipBonus + cardBonus
  const maxVal = Math.max(30, total * 1.6)
  const basePct  = Math.min(100, (base       / maxVal) * 100)
  const eqPct    = Math.min(100 - basePct,             ((equipBonus) / maxVal) * 100)
  const cardPct  = Math.min(100 - basePct - eqPct,     ((cardBonus)  / maxVal) * 100)

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
          <div className="flex items-center gap-1">
            {(equipBonus > 0 || cardBonus > 0) && (
              <span className="text-[10px] text-text-3">{base} →</span>
            )}
            <span className="text-[13px] font-bold text-text">{total}</span>
          </div>
        </div>
        <div className="h-[5px] bg-surface-2 border border-border rounded-full overflow-hidden flex">
          <div className="h-full" style={{ width: `${basePct}%`, background: color, opacity: 0.4 }} />
          <div className="h-full" style={{ width: `${eqPct}%`,   background: color, opacity: 0.75 }} />
          <div className="h-full" style={{ width: `${cardPct}%`, background: color }} />
        </div>
        {(equipBonus > 0 || cardBonus > 0) && (
          <div className="flex gap-2">
            {equipBonus > 0 && <span className="text-[10px] text-text-3">⚔ equipo <span style={{ color }}>+{equipBonus}</span></span>}
            {cardBonus  > 0 && <span className="text-[10px] text-text-3">✦ cartas <span style={{ color }}>+{cardBonus}</span></span>}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Runas ──────────────────────────────────────────────────────────────────── */

const RUNE_BONUS_LABELS = { attack: 'Atq', defense: 'Def', intelligence: 'Int', agility: 'Agi', max_hp: 'HP', strength: 'Fue' }
const RUNE_BONUS_COLORS = { attack: '#d97706', defense: '#6b7280', intelligence: '#7c3aed', agility: '#2563eb', max_hp: '#dc2626', strength: '#dc2626' }

function RuneInsertModal({ item, slotIndex, runeInventory, onInsert, onCancel }) {
  const available = runeInventory.filter(ir => ir.quantity > 0)

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6" onClick={onCancel}>
      <div
        className="bg-bg border border-border-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 p-5"
        style={{ width: 'min(340px, 92vw)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-text">Insertar Runa — Slot {slotIndex + 1}</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3 hover:text-text hover:bg-surface-2 transition-colors" onClick={onCancel}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <p className="text-[12px] text-text-3">
          <span className="font-semibold text-text">{item.item_catalog.name}</span>
          {' · '}Las runas son permanentes una vez incrustadas.
        </p>

        {available.length === 0 ? (
          <p className="text-[13px] text-text-3 text-center py-4">
            No tienes runas en el inventario. Craftéalas en el Laboratorio.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {available.map(ir => {
              const rc     = ir.rune_catalog
              const main   = rc.bonuses?.[0]
              const color  = RUNE_BONUS_COLORS[main?.stat] ?? '#475569'
              const bonusText = (rc.bonuses ?? []).map(({ stat, value }) => `+${value} ${RUNE_BONUS_LABELS[stat] ?? stat}`).join(' · ')
              return (
                <button
                  key={ir.rune_id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-[color:var(--blue-400)] bg-surface hover:bg-surface-2 transition-all text-left"
                  onClick={() => onInsert(ir.rune_id)}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold" style={{ background: `color-mix(in srgb,${color} 12%,var(--surface-2))`, color }}>
                    {ir.quantity}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-text truncate">{rc.name}</p>
                    <p className="text-[11px] text-text-3">{bonusText}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <button className="btn btn--ghost btn--sm self-end" onClick={onCancel}>Cancelar</button>
      </div>
    </div>,
    document.body
  )
}

/* ─── Componente principal ───────────────────────────────────────────────────── */

export default function Equipo() {
  const userId      = useAppStore(s => s.userId)
  const heroId      = useHeroId()
  const { buildings } = useBuildings(userId)
  const hasLab      = (buildings ?? []).some(b => b.type === 'laboratory' && b.level >= 1)
  const { hero }    = useHero(heroId)
  const { items }   = useInventory(heroId)
  const { cards }   = useHeroCards(heroId)
  const { inventory: runeInventory } = useHeroRunes(heroId)
  const { resources } = useResources(userId)
  const queryClient    = useQueryClient()
  const [confirm, setConfirm] = useState(null)
  const [tierUpgradeTarget, setTierUpgradeTarget] = useState(null)
  const [itemDetail, setItemDetail] = useState(null)
  const [runePickerTarget, setRunePickerTarget] = useState(null) // { item, slotIndex }
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
            if (item.item_catalog.is_two_handed && i.equipped_slot === 'off_hand') return { ...i, equipped_slot: null }
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
      toast.error(err.message)
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
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
  })

  const runeMutation = useMutation({
    mutationFn: ({ inventoryItemId, slotIndex, runeId }) =>
      apiPost('/api/rune-insert', { heroId, inventoryItemId, slotIndex, runeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroRunes(heroId) })
      toast.success('¡Runa incrustada!')
    },
    onError: err => toast.error(err.message),
  })

  const tierUpgradeMutation = useMutation({
    mutationFn: ({ inventoryItemId }) => apiPost('/api/item-upgrade-tier', { heroId, inventoryItemId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      setTierUpgradeTarget(null)
      toast.success(`¡Ítem mejorado a ${data.newItemName ?? `T${data.newTier}`}!`)
    },
    // El error se muestra inline en TierUpgradeModal, no como toast
  })

  const maxRuneSlots = BASE_RUNE_SLOTS

  const equippedBySlot = useMemo(() => {
    if (!items) return {}
    return Object.fromEntries(
      items.filter(i => i.equipped_slot).map(i => [i.equipped_slot, i])
    )
  }, [items])

  const unequipped = useMemo(() => (items ?? []).filter(i => !i.equipped_slot), [items])

  const { equipBonus, runeBonus } = useMemo(() => {
    const eq = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0, max_hp: 0 }
    const ru = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0, max_hp: 0 }
    const STAT_MAP = { attack: 'attack', defense: 'defense', max_hp: 'max_hp', strength: 'strength', agility: 'agility', intelligence: 'intelligence' }
    ;(items ?? []).filter(i => i.equipped_slot && i.current_durability > 0).forEach(i => {
      const c = i.item_catalog
      eq.attack       += c.attack_bonus       ?? 0
      eq.defense      += c.defense_bonus      ?? 0
      eq.strength     += c.strength_bonus     ?? 0
      eq.agility      += c.agility_bonus      ?? 0
      eq.intelligence += c.intelligence_bonus ?? 0
      eq.max_hp       += c.hp_bonus           ?? 0
      // Runas incrustadas en este ítem
      ;(i.item_runes ?? []).forEach(ir => {
        ;(ir.rune_catalog?.bonuses ?? []).forEach(({ stat, value }) => {
          if (stat in STAT_MAP) ru[STAT_MAP[stat]] += value
        })
      })
    })
    // equipBonus incluye tanto ítems como runas
    const combined = {}
    for (const k of Object.keys(eq)) combined[k] = eq[k] + ru[k]
    return { equipBonus: combined, runeBonus: ru }
  }, [items])

  const cardBonus = useMemo(() => {
    const b = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0, max_hp: 0 }
    const STAT_MAP = { max_hp: 'max_hp', attack: 'attack', defense: 'defense', strength: 'strength', agility: 'agility', intelligence: 'intelligence' }
    let enchantmentAmp = 0
    ;(cards ?? []).filter(c => c.slot_index !== null && c.slot_index !== undefined).forEach(c => {
      const sc   = c.skill_cards
      const rank = Math.min(c.rank, 5)
      if (Array.isArray(sc.bonuses))   sc.bonuses.forEach(({ stat, value }) => {
        if      (stat in STAT_MAP)          b[STAT_MAP[stat]] += Math.round(value * rank)
        else if (stat === 'enchantment_amp') enchantmentAmp   += value * rank
      })
      if (Array.isArray(sc.penalties)) sc.penalties.forEach(({ stat, value }) => {
        if (stat in STAT_MAP) b[STAT_MAP[stat]] -= Math.round(value * (1 + (rank - 1) * 0.5))
      })
    })
    // Aplicar enchantment_amp sobre los bonos de runas
    if (enchantmentAmp > 0) {
      for (const [stat, val] of Object.entries(runeBonus)) {
        if (val > 0) b[stat] = (b[stat] ?? 0) + Math.round(val * enchantmentAmp)
      }
    }
    return b
  }, [cards, runeBonus])

  if (!hero) {
    return (
      <div className="flex items-center justify-center h-40 text-text-3 text-[13px]">
        Selecciona un héroe
      </div>
    )
  }

  // eslint-disable-next-line react-hooks/purity
  const currentHp     = interpolateHp(hero, Date.now())
  const equippedCount = Object.keys(equippedBySlot).length

  function handleEquip(itemId) {
    equipMutation.mutate({ endpoint: '/api/item-equip', body: { itemId, equip: true } })
  }

  function handleUnequip(itemId) {
    equipMutation.mutate({ endpoint: '/api/item-equip', body: { itemId, equip: false } })
  }

  function handleRepair(item) {
    const cost     = estimateRepairCost(item)
    const costText = cost.mana > 0 ? `${cost.gold} oro · ${cost.mana} maná` : `${cost.gold} oro`
    setConfirm({
      title: `Reparar ${item.item_catalog.name}`,
      body: `Coste estimado: ${costText}`,
      confirmLabel: 'Reparar',
      onConfirm: () => {
        setConfirm(null)
        actionMutation.mutate({ endpoint: '/api/item-repair', body: { itemId: item.id } })
      },
    })
  }

  function handleRuneInsert(runeId) {
    if (!runePickerTarget) return
    runeMutation.mutate({
      inventoryItemId: runePickerTarget.item.id,
      slotIndex:       runePickerTarget.slotIndex,
      runeId,
    })
    setRunePickerTarget(null)
  }

  function handleUpgradeTier(item) {
    tierUpgradeMutation.reset()
    setTierUpgradeTarget(item)
  }

  function handleDismantle(item) {
    const mana = estimateDismantleMana(item)
    setConfirm({
      title: `Desmantelar ${item.item_catalog.name}`,
      body: `El ítem se destruirá y recuperarás ${mana} maná.`,
      confirmLabel: 'Desmantelar',
      onConfirm: () => {
        setConfirm(null)
        actionMutation.mutate({ endpoint: '/api/item-dismantle', body: { itemId: item.id, _dismantle: true } })
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Package size={16} strokeWidth={1.8} className="text-[var(--blue-600)]" />
            <span className="text-[16px] font-bold text-text">Gestionar Equipo</span>
          </div>
          <span className="text-[12px] text-text-3">
            {hero.name} · {equippedCount}/8 piezas · {currentHp}/{hero.max_hp} HP
          </span>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">

        {/* Stats */}
        <div className="flex flex-col gap-2 order-1 lg:order-2">
          <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Estadísticas</p>

          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)] sm:hidden">
            {STAT_CONFIG.map(({ key, label, color, Icon }) => {
              const total = (hero[key] ?? 0) + (equipBonus[key] ?? 0) + (cardBonus[key] ?? 0)
              return (
                <div key={key} className="flex flex-col items-center gap-0.5 py-1.5">
                  <Icon size={14} strokeWidth={2} style={{ color }} />
                  <span className="text-[15px] font-black text-text">{total}</span>
                  <span className="text-[9px] font-semibold text-text-3 text-center leading-tight">{label}</span>
                </div>
              )
            })}
          </div>

          <div className="hidden sm:flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
            {STAT_CONFIG.map(({ key, label, color, Icon }) => (
              <StatRow key={key} label={label} color={color} Icon={Icon}
                base={hero[key] ?? 0} equipBonus={equipBonus[key] ?? 0} cardBonus={cardBonus[key] ?? 0}
              />
            ))}
          </div>
        </div>

        {/* Equipment slots + Rune slots */}
        <div className="flex flex-col gap-2 order-2 lg:order-1">
          <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Equipamiento</p>
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
                />
              ))}
            </div>
          </div>

          {/* Rune slots — solo si el laboratorio está construido */}
          {hasLab && maxRuneSlots > 0 && Object.keys(equippedBySlot).length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} strokeWidth={2} className="text-[#7c3aed]" />
                <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Ranuras de Runa</p>
                <span className="text-[10px] text-text-3 font-normal">(permanentes)</span>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <div className="flex flex-col gap-3">
                  {ALL_SLOTS.map(slot => {
                    const item = equippedBySlot[slot]
                    if (!item) return null
                    const runesOnItem = item.item_runes ?? []
                    const rarColor = RARITY_COLORS[item.item_catalog.rarity] ?? '#6b7280'
                    return (
                      <div key={slot} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold truncate" style={{ color: rarColor }}>
                            {item.item_catalog.name}
                          </span>
                          <span className="text-[10px] text-text-3">{SLOT_META[slot]?.label}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {Array.from({ length: maxRuneSlots }).map((_, idx) => {
                            const inserted = runesOnItem.find(r => r.slot_index === idx)
                            if (inserted) {
                              const rc       = inserted.rune_catalog
                              const main     = rc?.bonuses?.[0]
                              const color    = RUNE_BONUS_COLORS[main?.stat] ?? '#7c3aed'
                              const bonusTxt = (rc?.bonuses ?? []).map(({ stat, value }) => `+${value} ${RUNE_BONUS_LABELS[stat] ?? stat}`).join(' · ')
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold"
                                  style={{ borderColor: `color-mix(in srgb,${color} 40%,var(--border))`, background: `color-mix(in srgb,${color} 8%,var(--surface-2))`, color }}
                                >
                                  <Sparkles size={10} strokeWidth={2} />
                                  {rc?.name ?? 'Runa'} <span className="text-[10px] font-normal opacity-70">{bonusTxt}</span>
                                </div>
                              )
                            }
                            return (
                              <button
                                key={idx}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-border text-[11px] text-text-3 hover:border-[color:var(--blue-400)] hover:text-[color:var(--blue-600)] transition-colors disabled:opacity-40"
                                onClick={() => setRunePickerTarget({ item, slotIndex: idx })}
                                disabled={runeMutation.isPending}
                              >
                                + Slot {idx + 1}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Inventory */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Mochila</p>
          {unequipped.length > 0 && <span className="text-[11px] text-text-3">{unequipped.length} ítems</span>}
        </div>

        {unequipped.length === 0 ? (
          <div className="flex items-center justify-center gap-2 h-20 text-[13px] text-text-3 border border-dashed border-border rounded-xl bg-surface">
            <Backpack size={14} strokeWidth={1.8} />
            Mochila vacía
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {unequipped.map(item => {
                const cat      = item.item_catalog
                const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
                const durPct   = cat.max_durability > 0 ? Math.round((item.current_durability / cat.max_durability) * 100) : 100
                const canEquip = durPct > 0
                return (
                  <div key={item.id} className="rounded-xl border border-border bg-surface-2 overflow-hidden">
                    {/* Info */}
                    <div className="px-3 pt-3 pb-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] font-semibold truncate" style={{ color: rarColor }}>{cat.name}</span>
                        <span className="text-[10px] font-bold text-text-3 bg-surface border border-border rounded px-1 flex-shrink-0">T{cat.tier}</span>
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: rarColor }}>{RARITY_LABELS[cat.rarity] ?? cat.rarity}</span>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {cat.attack_bonus       > 0 && <span className="text-[10px] text-[#d97706] font-medium">+{cat.attack_bonus} Atq</span>}
                        {cat.defense_bonus      > 0 && <span className="text-[10px] text-[#6b7280] font-medium">+{cat.defense_bonus} Def</span>}
                        {cat.hp_bonus           > 0 && <span className="text-[10px] text-[#dc2626] font-medium">+{cat.hp_bonus} HP</span>}
                        {cat.strength_bonus     > 0 && <span className="text-[10px] text-[#dc2626] font-medium">+{cat.strength_bonus} Fue</span>}
                        {cat.agility_bonus      > 0 && <span className="text-[10px] text-[#2563eb] font-medium">+{cat.agility_bonus} Agi</span>}
                        {cat.intelligence_bonus > 0 && <span className="text-[10px] text-[#7c3aed] font-medium">+{cat.intelligence_bonus} Int</span>}
                      </div>
                      <DurabilityBar current={item.current_durability} max={cat.max_durability} />
                    </div>
                    {/* Footer */}
                    <div className="flex border-t border-border divide-x divide-border">
                      <button
                        className="flex items-center justify-center px-3 py-2 text-text-3 hover:text-text-2 hover:bg-surface-2 transition-colors"
                        onClick={() => setItemDetail(item)}
                        title="Ver detalles"
                      >
                        <Info size={13} strokeWidth={2} />
                      </button>
                      <button
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40
                          ${canEquip
                            ? 'text-[var(--blue-600)] hover:bg-[color-mix(in_srgb,var(--blue-500)_6%,transparent)]'
                            : 'text-text-3 cursor-not-allowed'
                          }`}
                        onClick={() => canEquip && handleEquip(item.id)}
                        disabled={!canEquip}
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
                )
              })}
            </div>
          </div>
        )}
      </div>

      {itemDetail && (
        <ItemDetailModal item={itemDetail} onClose={() => setItemDetail(null)} />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {tierUpgradeTarget && (
        <TierUpgradeModal
          item={tierUpgradeTarget}
          resources={resources}
          isPending={tierUpgradeMutation.isPending}
          errorMsg={tierUpgradeMutation.error?.message ?? null}
          onConfirm={() => tierUpgradeMutation.mutate({ inventoryItemId: tierUpgradeTarget.id })}
          onCancel={() => { tierUpgradeMutation.reset(); setTierUpgradeTarget(null) }}
        />
      )}

      {runePickerTarget && (
        <RuneInsertModal
          item={runePickerTarget.item}
          slotIndex={runePickerTarget.slotIndex}
          runeInventory={runeInventory}
          onInsert={handleRuneInsert}
          onCancel={() => setRunePickerTarget(null)}
        />
      )}

    </div>
  )
}
