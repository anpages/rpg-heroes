import { useState, useEffect, useReducer } from 'react'
import { Coins, Axe, Sparkles, Layers, Flame, Plus, Clock, CheckCircle, Package, ArrowUp, Gem } from 'lucide-react'
import { motion } from 'framer-motion'
import { EFFECT_COLOR, RUNE_BONUS_LABELS, RUNE_BONUS_COLORS, describePotionEffect } from './constants.js'
import { LAB_INVENTORY_PER_UPGRADE, LAB_INVENTORY_MAX_UPGRADES, LAB_INVENTORY_UPGRADE_COSTS, MAX_POTION_STACK } from '../../lib/gameConstants.js'
import ScrollHint from '../../components/ScrollHint.jsx'

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
  atk_boost:       'Ataque',
  def_boost:       'Defensa',
  xp_boost:        'Experiencia',
  time_reduction:  'Tiempo',
  loot_boost:      'Botín',
  gold_boost:      'Oro',
  card_guaranteed: 'Cartas',
  free_repair:     'Reparación',
}

// Effect types ocultos en la UI de crafteo (no se eliminan del catálogo).
const HIDDEN_POTION_EFFECT_TYPES = new Set(['atk_boost', 'def_boost'])

const RUNE_FILTER_LABELS = {
  all:          'Todas',
  attack:       'Ataque',
  defense:      'Defensa',
  agility:      'Agilidad',
  intelligence: 'Inteligencia',
  max_hp:       'Vida',
  multi:        'Combinadas',
}

/* ─── Inventario del Laboratorio ─────────────────────────────────────────────── */

export function LabInventory({
  potions,
  runesCatalog,
  runesInventory,
  resources,
  onUpgrade,
  upgradePending,
  potionCraftingMap,
  runeCraftingMap,
  onPotionCollect,
  onRuneCollect,
  potionCollectPending,
  runeCollectPending,
  inventoryUsed,
  capacity,
}) {
  const upgrades = resources?.lab_inventory_upgrades ?? 0
  const canUpgrade = upgrades < LAB_INVENTORY_MAX_UPGRADES

  // Items con stock > 0 (completados)
  const potionItems = (potions ?? []).filter(p => p.quantity > 0)
  const runeInvMap = Object.fromEntries((runesInventory ?? []).map(r => [r.rune_id, r.quantity]))
  const runeItems = (runesCatalog ?? []).filter(r => (runeInvMap[r.id] ?? 0) > 0).map(r => ({
    ...r,
    quantity: runeInvMap[r.id],
    _isRune: true,
  }))

  const allItems = [
    ...potionItems.map(p => ({ ...p, _isRune: false })),
    ...runeItems,
  ]

  // Activos (crafteando/listos) — se renderizan en subsección propia
  const potionById = Object.fromEntries((potions ?? []).map(p => [p.id, p]))
  const runeById = Object.fromEntries((runesCatalog ?? []).map(r => [r.id, r]))
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
  for (const [runeId, craft] of Object.entries(runeCraftingMap ?? {})) {
    const rune = runeById[runeId]
    if (!rune) continue
    const remaining = Math.max(0, new Date(craft.craft_ends_at) - now)
    activeItems.push({
      kind: 'rune',
      key: `a-r-${runeId}`,
      id: runeId,
      name: rune.name,
      color: RUNE_BONUS_COLORS[rune.bonuses?.[0]?.stat] ?? '#475569',
      remaining,
    })
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
              const collectPending = item.kind === 'potion' ? potionCollectPending : runeCollectPending
              const onCollect = item.kind === 'potion' ? onPotionCollect : onRuneCollect
              const Icon = item.kind === 'potion' ? Flame : Gem
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
              const isRune = item._isRune
              const color = isRune
                ? (RUNE_BONUS_COLORS[item.bonuses?.[0]?.stat] ?? '#475569')
                : (EFFECT_COLOR[item.effect_type] ?? '#475569')

              return (
                <div
                  key={isRune ? `r-${item.id}` : `p-${item.id}`}
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
                    <p className="text-[10px] text-text-3 truncate" style={isRune ? undefined : { color }}>
                      {isRune ? 'Runa' : describePotionEffect(item.effect_type, item.effect_value)}
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

export function LaboratorySection({ labLevel, potions, craftingMap, craftPending, resources, onCraft, isUpgrading = false, inventoryFull = false }) {
  const availablePotions = potions.filter(p =>
    p.min_lab_level <= labLevel && !HIDDEN_POTION_EFFECT_TYPES.has(p.effect_type)
  )

  function canAfford(p) {
    if (!resources) return false
    return resources.gold >= p.recipe_gold
      && resources.wood >= p.recipe_wood
      && resources.mana >= p.recipe_mana
      && (resources.fragments ?? 0) >= (p.recipe_fragments ?? 0)
      && (resources.essence   ?? 0) >= (p.recipe_essence   ?? 0)
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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {p.recipe_gold > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.gold >= p.recipe_gold ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Coins size={10} strokeWidth={2} />{p.recipe_gold}
                      </span>
                    )}
                    {p.recipe_mana > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.mana >= p.recipe_mana ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Sparkles size={10} strokeWidth={2} />{p.recipe_mana}
                      </span>
                    )}
                    {p.recipe_wood > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.wood >= p.recipe_wood ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Axe size={10} strokeWidth={2} />{p.recipe_wood}
                      </span>
                    )}
                    {p.recipe_fragments > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${(resources?.fragments ?? 0) >= p.recipe_fragments ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Layers size={10} strokeWidth={2} />{p.recipe_fragments}
                      </span>
                    )}
                    {p.recipe_essence > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${(resources?.essence ?? 0) >= p.recipe_essence ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Flame size={10} strokeWidth={2} />{p.recipe_essence}
                      </span>
                    )}
                    <span className="flex items-center gap-[3px] text-[11px] text-text-3 opacity-60">
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

/* ─── Sección de Runas ───────────────────────────────────────────────────────── */

export function RunesSection({ labLevel, catalog, resources, craftingMap, craftPending, onCraft, isUpgrading = false, inventoryFull = false }) {
  const availableRunes = catalog.filter(r => r.min_lab_level <= labLevel)

  // Clasificar: multi = más de 1 stat, single = stat principal
  function runeCategory(r) {
    if ((r.bonuses ?? []).length > 1) return 'multi'
    return r.bonuses?.[0]?.stat ?? 'attack'
  }

  function canAfford(r) {
    if (!resources) return false
    return (resources.gold      ?? 0) >= (r.recipe_gold      ?? 0)
        && (resources.wood      ?? 0) >= (r.recipe_wood      ?? 0)
        && (resources.mana      ?? 0) >= (r.recipe_mana      ?? 0)
        && (resources.fragments ?? 0) >= (r.recipe_fragments ?? 0)
        && (resources.essence   ?? 0) >= (r.recipe_essence   ?? 0)
  }

  // Runas crafteables ahora (puedo pagar + no ya crafteando)
  const crafteableCount = availableRunes.filter(r =>
    canAfford(r) && !craftingMap[r.id]
  ).length

  // Ordenar categorías por min_lab_level de su primera aparición
  const catFirst = {}
  for (const r of availableRunes) {
    const cat = runeCategory(r)
    if (!(cat in catFirst) || r.min_lab_level < catFirst[cat]) {
      catFirst[cat] = r.min_lab_level
    }
  }
  const catCounts = {}
  for (const r of availableRunes) {
    const cat = runeCategory(r)
    catCounts[cat] = (catCounts[cat] ?? 0) + 1
  }

  const sortedCats = Object.keys(catFirst).sort((a, b) => catFirst[a] - catFirst[b])

  // Pill "Crafteable" primero, luego por categoría
  const filterOptions = [
    { value: '_crafteable', label: 'Crafteable', count: crafteableCount },
    ...sortedCats.map(cat => ({
      value: cat,
      label: RUNE_FILTER_LABELS[cat] ?? cat,
      count: catCounts[cat] ?? 0,
    })),
  ]

  const [filter, setFilter] = useState(() => crafteableCount > 0 ? '_crafteable' : sortedCats[0] ?? 'attack')

  const filtered = filter === '_crafteable'
    ? availableRunes.filter(r => canAfford(r) && !craftingMap[r.id])
    : availableRunes.filter(r => runeCategory(r) === filter)

  function bonusText(bonuses) {
    return (bonuses ?? []).map(({ stat, value }) => `+${value} ${RUNE_BONUS_LABELS[stat] ?? stat}`).join(' · ')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">Crafteo de Runas</p>

      {filterOptions.length > 1 && (
        <FilterPills options={filterOptions} value={filter} onChange={setFilter} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filtered.map(r => {
          const isCrafting = !!craftingMap[r.id]
          const affordable = canAfford(r)
          const mainBonus  = r.bonuses?.[0]
          const color      = RUNE_BONUS_COLORS[mainBonus?.stat] ?? '#475569'
          const disabled   = !affordable || isCrafting || craftPending || isUpgrading || inventoryFull

          return (
            <div
              key={r.id}
              className="flex flex-col rounded-xl overflow-hidden border border-border bg-surface"
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px]"
                  style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
                >
                  ✦
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-text truncate">{r.name}</p>
                  <p className="text-[11px] text-text-3 mt-0.5">{bonusText(r.bonuses)}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {(r.recipe_gold ?? 0) > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.gold >= r.recipe_gold ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Coins size={10} strokeWidth={2} />{r.recipe_gold}
                      </span>
                    )}
                    {(r.recipe_mana ?? 0) > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.mana >= r.recipe_mana ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Sparkles size={10} strokeWidth={2} />{r.recipe_mana}
                      </span>
                    )}
                    {(r.recipe_wood ?? 0) > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.wood >= r.recipe_wood ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Axe size={10} strokeWidth={2} />{r.recipe_wood}
                      </span>
                    )}
                    {(r.recipe_fragments ?? 0) > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${(resources?.fragments ?? 0) >= r.recipe_fragments ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Layers size={10} strokeWidth={2} />{r.recipe_fragments}
                      </span>
                    )}
                    {(r.recipe_essence ?? 0) > 0 && (
                      <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${(resources?.essence ?? 0) >= r.recipe_essence ? 'text-[#16a34a]' : 'text-error-text'}`}>
                        <Flame size={10} strokeWidth={2} />{r.recipe_essence}
                      </span>
                    )}
                    <span className="flex items-center gap-[3px] text-[11px] text-text-3 opacity-60">
                      <Clock size={9} strokeWidth={2} />{r.craft_minutes ?? 60}m
                    </span>
                  </div>
                </div>

                <motion.button
                  className="btn btn--primary btn--sm flex-shrink-0"
                  onClick={() => onCraft(r.id)}
                  disabled={disabled}
                  whileTap={disabled ? {} : { scale: 0.96 }}
                  title={
                    isCrafting ? 'Ya crafteando' :
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
            No tienes materiales suficientes para craftear ninguna runa
          </p>
        )}

        {filtered.length === 0 && filter !== '_crafteable' && availableRunes.length > 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            No hay runas en esta categoría
          </p>
        )}

        {availableRunes.length === 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            Sube el Laboratorio a Nv.2 para desbloquear el crafteo de runas
          </p>
        )}
      </div>
    </div>
  )
}
