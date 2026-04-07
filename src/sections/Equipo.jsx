import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useHeroCards } from '../hooks/useHeroCards'
import { interpolateHp } from '../lib/hpInterpolation'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import {
  Crown, Shirt, Hand, Move, Sword, Shield, Gem,
  Heart, Dumbbell, Wind, Brain, Backpack, Wrench, Trash2, X,
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

const REPAIR_COST_TABLE = {
  common:    { gold: 2,  mana: 0  },
  uncommon:  { gold: 3,  mana: 1  },
  rare:      { gold: 5,  mana: 3  },
  epic:      { gold: 8,  mana: 6  },
  legendary: { gold: 12, mana: 10 },
}

const DISMANTLE_MANA_TABLE = {
  common: 3, uncommon: 8, rare: 20, epic: 50, legendary: 120,
}

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

function EquipmentSlot({ slotKey, item, onUnequip, onRepair, loading }) {
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

  const cat      = item.item_catalog
  const mainStat = mainStatForSlot(slotKey, cat)
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
  const durPct   = cat.max_durability > 0 ? Math.round((item.current_durability / cat.max_durability) * 100) : 100
  const needsRepair = durPct < 100

  return (
    <div className="relative group flex flex-col p-3 rounded-xl border border-border bg-surface transition-all duration-150 min-h-[64px] gap-0.5 overflow-hidden">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ color: rarColor }}>
          <Icon size={13} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[12px] font-semibold truncate" style={{ color: rarColor }}>{cat.name}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {mainStat && (
                <span className="text-[11px] font-bold" style={{ color: mainStat.color }}>+{mainStat.value}</span>
              )}
              <span className="text-[10px] font-bold text-text-3 bg-surface-2 border border-border rounded px-1">T{cat.tier}</span>
            </div>
          </div>
          <span className="text-[10px] text-text-3 capitalize">{label}</span>
        </div>
      </div>
      <DurabilityBar current={item.current_durability} max={cat.max_durability} />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        {needsRepair && (
          <button
            className="flex items-center gap-1 text-[11px] font-bold text-[#d97706] bg-black/60 rounded-lg px-2.5 py-1.5 hover:bg-black/75 transition-colors disabled:opacity-40"
            onClick={() => onRepair(item)}
            disabled={loading}
          >
            <Wrench size={11} strokeWidth={2} />
            Reparar
          </button>
        )}
        <button
          className="text-[11px] font-bold text-white bg-black/60 rounded-lg px-3 py-1.5 hover:bg-black/75 transition-colors disabled:opacity-40"
          onClick={() => onUnequip(item.id)}
          disabled={loading}
        >
          Desequipar
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

/* ─── Componente principal ───────────────────────────────────────────────────── */

export default function Equipo() {
  const heroId      = useHeroId()
  const { hero }    = useHero(heroId)
  const { items }   = useInventory(heroId)
  const { cards }   = useHeroCards(heroId)
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(null)

  const mutation = useMutation({
    mutationFn: ({ endpoint, body }) => apiPost(endpoint, body),
    onMutate: async ({ optimisticUpdate }) => {
      if (!optimisticUpdate) return
      const key = queryKeys.inventory(heroId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, optimisticUpdate)
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKeys.inventory(heroId), context.previous)
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(hero?.player_id) })
    },
  })

  const equippedBySlot = useMemo(() => {
    if (!items) return {}
    return Object.fromEntries(
      items.filter(i => i.equipped_slot).map(i => [i.equipped_slot, i])
    )
  }, [items])

  const unequipped = useMemo(() => (items ?? []).filter(i => !i.equipped_slot), [items])

  const equipBonus = useMemo(() => {
    const b = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0, max_hp: 0 }
    ;(items ?? []).filter(i => i.equipped_slot && i.current_durability > 0).forEach(i => {
      const c = i.item_catalog
      b.attack       += c.attack_bonus       ?? 0
      b.defense      += c.defense_bonus      ?? 0
      b.strength     += c.strength_bonus     ?? 0
      b.agility      += c.agility_bonus      ?? 0
      b.intelligence += c.intelligence_bonus ?? 0
      b.max_hp       += c.hp_bonus           ?? 0
    })
    return b
  }, [items])

  const cardBonus = useMemo(() => {
    const b = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0, max_hp: 0 }
    const STAT_MAP = { max_hp: 'max_hp', attack: 'attack', defense: 'defense', strength: 'strength', agility: 'agility', intelligence: 'intelligence' }
    ;(cards ?? []).filter(c => c.equipped).forEach(c => {
      const sc   = c.skill_cards
      const rank = Math.min(c.rank, 5)
      if (Array.isArray(sc.bonuses))   sc.bonuses.forEach(({ stat, value }) => { if (stat in STAT_MAP) b[STAT_MAP[stat]] += value * rank })
      if (Array.isArray(sc.penalties)) sc.penalties.forEach(({ stat, value }) => { if (stat in STAT_MAP) b[STAT_MAP[stat]] -= value * rank })
    })
    return b
  }, [cards])

  if (!hero) {
    return (
      <div className="flex items-center justify-center h-40 text-text-3 text-[13px]">
        Selecciona un héroe
      </div>
    )
  }

  const loading       = mutation.isPending
  // eslint-disable-next-line react-hooks/purity
  const currentHp     = interpolateHp(hero, Date.now())
  const equippedCount = Object.keys(equippedBySlot).length

  function handleEquip(itemId) {
    const item = items?.find(i => i.id === itemId)
    if (!item) return
    const targetSlot = item.item_catalog.slot
    mutation.mutate({
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
    mutation.mutate({
      endpoint: '/api/item-equip',
      body: { itemId, equip: false },
      optimisticUpdate: items?.map(i => i.id === itemId ? { ...i, equipped_slot: null } : i),
    })
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
        mutation.mutate({ endpoint: '/api/item-repair', body: { itemId: item.id } })
      },
    })
  }

  function handleDismantle(item) {
    const mana = estimateDismantleMana(item)
    setConfirm({
      title: `Desmantelar ${item.item_catalog.name}`,
      body: `El ítem se destruirá y recuperarás ${mana} maná.`,
      confirmLabel: 'Desmantelar',
      onConfirm: () => {
        setConfirm(null)
        mutation.mutate({
          endpoint: '/api/item-dismantle',
          body: { itemId: item.id },
          optimisticUpdate: items?.filter(i => i.id !== item.id),
        })
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Hero header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="w-11 h-11 rounded-full bg-[var(--blue-100)] border-2 border-[var(--blue-300)] flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_var(--blue-200)]">
          <span className="text-[19px] font-black text-[var(--blue-700)]">
            {(hero.name ?? '?')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[17px] font-bold text-text">{hero.name}</span>
            <span className="text-[11px] font-semibold text-text-3 bg-surface-2 border border-border px-2 py-0.5 rounded-full">
              Nv. {hero.level}
            </span>
          </div>
          <span className="text-[12px] text-text-3">
            {equippedCount}/8 piezas · {currentHp}/{hero.max_hp} HP
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

        {/* Equipment slots */}
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
                  loading={loading}
                />
              ))}
            </div>
          </div>
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
                  <div key={item.id} className="flex flex-col gap-1.5 p-3 rounded-xl border border-border bg-surface-2 transition-all duration-150">
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
                    {/* Actions */}
                    <div className="flex gap-1.5 mt-0.5">
                      <button
                        className="flex-1 text-[11px] font-bold py-1 rounded-lg border transition-colors disabled:opacity-40"
                        style={canEquip
                          ? { color: 'var(--blue-600)', borderColor: 'var(--blue-400)', background: 'color-mix(in srgb, var(--blue-500) 8%, transparent)' }
                          : { color: 'var(--text-3)', borderColor: 'var(--border)', background: 'var(--surface)', cursor: 'not-allowed' }
                        }
                        onClick={() => canEquip && handleEquip(item.id)}
                        disabled={!canEquip || loading}
                        title={canEquip ? 'Equipar' : 'Repara el ítem antes de equiparlo'}
                      >
                        Equipar
                      </button>
                      <button
                        className="flex items-center justify-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border border-border text-text-3 hover:text-[#dc2626] hover:border-[color-mix(in_srgb,#dc2626_30%,var(--border))] hover:bg-[color-mix(in_srgb,#dc2626_6%,transparent)] transition-colors disabled:opacity-40"
                        onClick={() => handleDismantle(item)}
                        disabled={loading}
                        title="Desmantelar"
                      >
                        <Trash2 size={11} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

    </div>
  )
}
