import { useState, useEffect, useReducer } from 'react'
import { Coins, Axe, Sparkles, Layers, Flame, Plus, Clock, CheckCircle, Package, ArrowUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { EFFECT_COLOR, describePotionEffect, RESOURCE_LABEL } from './constants.js'
import { LAB_INVENTORY_PER_UPGRADE, LAB_INVENTORY_MAX_UPGRADES, LAB_INVENTORY_UPGRADE_COSTS, MAX_POTION_STACK } from '../../lib/gameConstants.js'
import ScrollHint from '../../components/ScrollHint.jsx'

const ITEM_LABELS = {
  potion_base: 'Base Poc.', steel_ingot: 'Lingote', plank: 'Tablón',
  mana_crystal: 'Cristal', herbal_extract: 'Extracto',
  tempered_steel: 'Acero T.', composite_wood: 'Madera C.', concentrated_mana: 'Maná C.',
}

function formatMs(ms) {
  if (ms <= 0) return '0:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function useTickWhileActive(hasAnyCrafting) {
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  useEffect(() => {
    if (!hasAnyCrafting) return
    const id = setInterval(forceUpdate, 1000)
    return () => clearInterval(id)
  }, [hasAnyCrafting])
}

/* ─── Pills de filtro reutilizables ──────────────────────────────────────────── */

function FilterPills({ options, value, onChange }) {
  return (
    <ScrollHint>
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors duration-150 ${
              active
                ? 'bg-[#2563eb] text-white'
                : 'bg-surface-2 text-text-3 hover:text-text-2'
            }`}
          >
            {o.label}{o.count != null ? ` (${o.count})` : ''}
          </button>
        )
      })}
    </ScrollHint>
  )
}

/* ─── Constantes de filtros ──────────────────────────────────────────────────── */

const POTION_FILTER_LABELS = {
  all:             'Todas',
  hp_restore:      'Vida',
  xp_boost:        'Experiencia',
  time_reduction:  'Tiempo',
  loot_boost:      'Botín',
  gold_boost:      'Oro',
  card_guaranteed: 'Tácticas',
  free_repair:     'Reparación',
}

const HIDDEN_POTION_EFFECT_TYPES = new Set([])

/* ─── Inventario del Laboratorio ─────────────────────────────────────────────── */

export function LabInventory({
  potions,
  resources,
  onUpgrade,
  upgradePending,
  potionCraftingMap,
  onPotionCollect,
  potionCollectPending,
  inventoryUsed,
  capacity,
}) {
  const upgrades = resources?.lab_inventory_upgrades ?? 0
  const canUpgrade = upgrades < LAB_INVENTORY_MAX_UPGRADES

  // Items con stock > 0 (completados)
  const potionItems = (potions ?? []).filter(p => p.quantity > 0)

  const allItems = potionItems

  // Activos (crafteando/listos) — se renderizan en subsección propia
  const potionById = Object.fromEntries((potions ?? []).map(p => [p.id, p]))
  const now = Date.now()

  const activeItems = []
  for (const [potionId, crafts] of Object.entries(potionCraftingMap ?? {})) {
    const potion = potionById[potionId]
    if (!potion) continue
    for (const craft of crafts) {
      const remaining = Math.max(0, new Date(craft.craft_ends_at) - now)
      activeItems.push({
        kind: 'potion',
        key: `a-p-${craft.id}`,
        id: craft.id,
        name: potion.name,
        color: EFFECT_COLOR[potion.effect_type] ?? '#475569',
        remaining,
      })
    }
  }
  // Listos primero, luego por remaining ascendente
  activeItems.sort((a, b) => a.remaining - b.remaining)

  const hasActive = activeItems.length > 0
  useTickWhileActive(hasActive)

  const upgradeCost = canUpgrade ? LAB_INVENTORY_UPGRADE_COSTS[upgrades] : null
  const canAffordUpgrade = upgradeCost && resources
    && (resources.gold ?? 0) >= (upgradeCost.gold ?? 0)
    && (resources.mana ?? 0) >= (upgradeCost.mana ?? 0)

  const isEmpty = allItems.length === 0 && !hasActive

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3 flex items-center gap-1.5">
          <Package size={12} strokeWidth={2} />
          Inventario
        </p>
        <span className="text-[12px] font-semibold text-text-2">
          {inventoryUsed} <span className="text-text-3">/ {capacity}</span>
        </span>
      </div>

      {/* Barra de capacidad */}
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(100, (inventoryUsed / capacity) * 100)}%`,
            background: inventoryUsed >= capacity ? '#dc2626' : inventoryUsed >= capacity * 0.8 ? '#d97706' : '#2563eb',
          }}
        />
      </div>

      {/* Subsección: En proceso */}
      {hasActive && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-3 mt-1">
            En proceso ({activeItems.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {activeItems.map(item => {
              const isReady = item.remaining <= 0
              const collectPending = potionCollectPending
              const onCollect = onPotionCollect
              const Icon = Flame
              return (
                <motion.button
                  key={item.key}
                  type="button"
                  onClick={isReady && !collectPending ? () => onCollect(item.id) : undefined}
                  disabled={!isReady || collectPending}
                  whileTap={isReady && !collectPending ? { scale: 0.97 } : {}}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-surface text-left transition-colors ${
                    isReady
                      ? 'border-[#16a34a] cursor-pointer hover:bg-[color-mix(in_srgb,#16a34a_6%,var(--surface))]'
                      : 'border-[#d97706] cursor-default'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb,${item.color} 12%,var(--surface-2))`, color: item.color }}
                  >
                    {isReady ? <CheckCircle size={14} strokeWidth={2.5} /> : <Icon size={14} strokeWidth={2} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-text truncate">{item.name}</p>
                    <p className={`flex items-center gap-1 text-[10px] font-bold ${isReady ? 'text-[#16a34a]' : 'text-[#d97706]'}`}>
                      {isReady ? (
                        '¡Recoger!'
                      ) : (
                        <>
                          <Clock size={9} strokeWidth={2.5} />
                          {formatMs(item.remaining)}
                        </>
                      )}
                    </p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </>
      )}

      {isEmpty ? (
        <p className="text-[13px] text-text-3 text-center py-4">
          Aún no has crafteado nada
        </p>
      ) : allItems.length > 0 ? (
        <>
          {hasActive && (
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-3 mt-1">Completados</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allItems.map(item => {
              const color = EFFECT_COLOR[item.effect_type] ?? '#475569'

              return (
                <div
                  key={`p-${item.id}`}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-surface"
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-[12px] font-extrabold"
                    style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
                  >
                    {item.quantity}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-text truncate">{item.name}</p>
                    <p className="text-[10px] text-text-3 truncate" style={{ color }}>
                      {describePotionEffect(item.effect_type, item.effect_value)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}

      {/* Botón de ampliar */}
      {canUpgrade && (
        <motion.button
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-border bg-surface text-[12px] font-semibold text-text-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
          onClick={onUpgrade}
          disabled={!canAffordUpgrade || upgradePending}
          whileTap={!canAffordUpgrade || upgradePending ? {} : { scale: 0.98 }}
        >
          <ArrowUp size={12} strokeWidth={2.5} />
          Ampliar a {capacity + LAB_INVENTORY_PER_UPGRADE}
          <span className="flex items-center gap-1.5 ml-1">
            {(upgradeCost.gold ?? 0) > 0 && (
              <span className={`flex items-center gap-[2px] ${(resources?.gold ?? 0) >= upgradeCost.gold ? 'text-[#16a34a]' : 'text-error-text'}`}>
                <Coins size={10} strokeWidth={2} />{upgradeCost.gold}
              </span>
            )}
            {(upgradeCost.mana ?? 0) > 0 && (
              <span className={`flex items-center gap-[2px] ${(resources?.mana ?? 0) >= upgradeCost.mana ? 'text-[#16a34a]' : 'text-error-text'}`}>
                <Sparkles size={10} strokeWidth={2} />{upgradeCost.mana}
              </span>
            )}
          </span>
        </motion.button>
      )}
    </div>
  )
}

/* ─── Sección de Pociones ────────────────────────────────────────────────────── */

export function LaboratorySection({ labLevel, potions, craftingMap, craftPending, resources, craftedItems, onCraft, isUpgrading = false, inventoryFull = false }) {
  const availablePotions = potions.filter(p =>
    p.min_lab_level <= labLevel && !HIDDEN_POTION_EFFECT_TYPES.has(p.effect_type)
  )

  function canAfford(p) {
    if (!resources) return false
    const items = p.recipe_items ?? []
    return items.every(inp => {
      if (inp.resource) return (resources[inp.resource] ?? 0) >= inp.qty
      if (inp.item)     return (craftedItems?.[inp.item] ?? 0) >= inp.qty
      return false
    })
  }

  // Pociones crafteables ahora (puedo pagar + no stack lleno)
  const crafteableCount = availablePotions.filter(p =>
    canAfford(p) && p.quantity + (craftingMap[p.id] ?? []).length < MAX_POTION_STACK
  ).length

  // Ordenar categorías por min_lab_level de su primera aparición
  const typeFirst = {}
  for (const p of availablePotions) {
    if (!(p.effect_type in typeFirst) || p.min_lab_level < typeFirst[p.effect_type]) {
      typeFirst[p.effect_type] = p.min_lab_level
    }
  }
  const typeCounts = {}
  for (const p of availablePotions) {
    typeCounts[p.effect_type] = (typeCounts[p.effect_type] ?? 0) + 1
  }

  const sortedTypes = Object.keys(typeFirst).sort((a, b) => typeFirst[a] - typeFirst[b])

  // Pill "Crafteable" primero, luego por tipo de efecto
  const filterOptions = [
    { value: '_crafteable', label: 'Crafteable', count: crafteableCount },
    ...sortedTypes.map(type => ({
      value: type,
      label: POTION_FILTER_LABELS[type] ?? type,
      count: typeCounts[type] ?? 0,
    })),
  ]

  const [filter, setFilter] = useState(() => crafteableCount > 0 ? '_crafteable' : sortedTypes[0] ?? 'hp_restore')

  const filtered = filter === '_crafteable'
    ? availablePotions.filter(p => canAfford(p) && p.quantity + (craftingMap[p.id] ?? []).length < MAX_POTION_STACK)
    : availablePotions.filter(p => p.effect_type === filter)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">Recetas disponibles</p>

      {filterOptions.length > 1 && (
        <FilterPills options={filterOptions} value={filter} onChange={setFilter} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filtered.map(p => {
          const activeForThis = (craftingMap[p.id] ?? []).length
          const affordable = canAfford(p)
          const stackFull  = p.quantity + activeForThis >= MAX_POTION_STACK
          const disabled   = !affordable || stackFull || craftPending || isUpgrading || inventoryFull
          const color      = EFFECT_COLOR[p.effect_type] ?? '#475569'

          return (
            <div
              key={p.id}
              className="flex flex-col rounded-xl overflow-hidden border border-border bg-surface"
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[14px]"
                  style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
                >
                  <Flame size={16} strokeWidth={2} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-text truncate">{p.name}</p>
                  {p.description && <p className="text-[13px] text-text-3 mt-0.5 line-clamp-2 leading-snug">{p.description}</p>}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {(p.recipe_items ?? []).map(inp => {
                      const key = inp.resource ?? inp.item
                      const needed = inp.qty
                      const available = inp.resource
                        ? (resources?.[inp.resource] ?? 0)
                        : (craftedItems?.[inp.item] ?? 0)
                      const has = available >= needed
                      return (
                        <span
                          key={key}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            color: has ? 'var(--text-2)' : '#dc2626',
                            background: has ? 'var(--surface-2)' : 'color-mix(in srgb, #dc2626 8%, var(--surface))',
                          }}
                        >
                          {needed} {inp.resource ? (RESOURCE_LABEL[inp.resource] ?? inp.resource) : (ITEM_LABELS[inp.item] ?? inp.item)}
                        </span>
                      )
                    })}
                    <span className="flex items-center gap-[3px] text-[10px] text-text-3 opacity-60">
                      <Clock size={9} strokeWidth={2} />{p.craft_minutes ?? 30}m
                    </span>
                  </div>
                </div>

                <motion.button
                  className="btn btn--primary btn--sm flex-shrink-0"
                  onClick={() => onCraft(p.id)}
                  disabled={disabled}
                  whileTap={disabled ? {} : { scale: 0.96 }}
                  title={
                    stackFull ? 'Máximo alcanzado' :
                    inventoryFull ? 'Inventario lleno' :
                    !affordable ? 'Recursos insuficientes' :
                    undefined
                  }
                >
                  <Plus size={13} strokeWidth={2.5} />
                </motion.button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && filter === '_crafteable' && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            No tienes materiales suficientes para craftear ninguna poción
          </p>
        )}

        {filtered.length === 0 && filter !== '_crafteable' && availablePotions.length > 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            No hay recetas en esta categoría
          </p>
        )}

        {availablePotions.length === 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            Sube el Laboratorio para desbloquear recetas
          </p>
        )}
      </div>
    </div>
  )
}

