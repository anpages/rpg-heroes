import { useState, useEffect, useRef, useReducer } from 'react'
import { Clock, Lock, Check, Minus, Plus, Warehouse } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../../lib/notifications.js'
import {
  buildingUpgradeCost, buildingUpgradeDurationMs,
} from '../../lib/gameConstants.js'
import { apiPost } from '../../lib/api.js'
import { BUILDING_META } from './constants.js'
import { fmtTime } from './helpers.js'
import { LockedBuildingCard } from './BuildingCard.jsx'
import { cardVariants } from './constants.js'
import BuildingInfoModal from './BuildingInfoModal.jsx'

const REFINING_BUILDINGS = ['carpinteria', 'fundicion', 'destileria_arcana', 'herbolario']

const INPUT_LABELS = {
  iron: 'Hierro', wood: 'Madera', mana: 'Maná', herbs: 'Hierbas',
  plank: 'Tablón', steel_ingot: 'Lingote', mana_crystal: 'Cristal', herbal_extract: 'Extracto',
}

/* Productos que produce cada edificio de refinado (para mostrar stock) */
const BUILDING_PRODUCTS = {
  carpinteria:       [
    { id: 'plank',           name: 'Tablones',       icon: '🪵' },
    { id: 'composite_wood',  name: 'Madera Comp.',   icon: '🪵' },
  ],
  fundicion:         [
    { id: 'steel_ingot',     name: 'Lingotes',       icon: '⚙️' },
    { id: 'tempered_steel',  name: 'Acero Templ.',   icon: '⚙️' },
  ],
  destileria_arcana: [
    { id: 'mana_crystal',    name: 'Cristales',      icon: '💎' },
    { id: 'concentrated_mana', name: 'Maná Conc.',   icon: '💎' },
  ],
  herbolario:        [
    { id: 'herbal_extract',  name: 'Extractos',      icon: '🌿' },
    { id: 'potion_base',     name: 'Base Poc.',      icon: '🌿' },
  ],
}

/* ── RefinadoZone ──────────────────────────────────────────────────────────── */

export default function RefinadoZone({
  byType, effectiveResources, catalog, inventory, refiningSlots,
  onRefine, onCollectAllSlots,
  anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending,
}) {
  return (
    <motion.div className="flex flex-col gap-3" variants={cardVariants} initial="initial" animate="animate">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {REFINING_BUILDINGS.map(type => {
        const b = byType[type]
        if (!b) return null
        if (b.unlocked === false) return <LockedBuildingCard key={type} type={type} />

        const recipes = (catalog ?? []).filter(c => c.refinery_type === type)
        const slots = (refiningSlots ?? []).filter(s => s.building_type === type)

        return (
          <RefineryCard
            key={b.id}
            building={b}
            recipes={recipes}
            inventory={inventory}
            slots={slots}
            resources={effectiveResources}
            onRefine={onRefine}
            onCollectAll={() => onCollectAllSlots(type)}
            anyUpgrading={anyUpgrading}
            onUpgradeStart={onUpgradeStart}
            onUpgradeCollect={onUpgradeCollect}
            onOptimisticDeduct={onOptimisticDeduct}
            onUpgradePending={onUpgradePending}
          />
        )
      })}
      </div>
    </motion.div>
  )
}

/* ── useUpgradeTimer ───────────────────────────────────────────────────────── */

function useUpgradeTimer(building, onUpgradeCollect) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [loading, setLoading]         = useState(false)
  const mountedRef     = useRef(false)
  const collectingRef  = useRef(false)

  useEffect(() => {
    const hasUpgrade = !!building.upgrade_ends_at
    if (!hasUpgrade) {
      setSecondsLeft(null)
      setLoading(false)
      mountedRef.current    = false
      collectingRef.current = false
      return
    }
    const endTime = new Date(building.upgrade_ends_at)

    async function autoCollect() {
      if (collectingRef.current) return
      collectingRef.current = true
      setLoading(true)
      try {
        await apiPost('/api/building-upgrade-collect', { buildingId: building.id })
        onUpgradeCollect()
        setLoading(false)
      } catch (err) {
        notify.error(err.message)
        setLoading(false)
        collectingRef.current = false
      }
    }

    function tick() {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) autoCollect()
    }
    tick()
    requestAnimationFrame(() => { mountedRef.current = true })
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building.upgrade_ends_at, building.id])

  return { secondsLeft, loading, mountedRef }
}

/* ── Helpers para calcular progreso de un slot ─────────────────────────────── */

function slotProgress(slot) {
  const now = Date.now()
  const startedAt = new Date(slot.craft_started_at).getTime()
  const elapsedMs = now - startedAt
  const completed = Math.min(slot.quantity, Math.floor(elapsedMs / slot.unit_duration_ms))
  const remaining = slot.quantity - completed
  const currentPct = remaining > 0
    ? ((elapsedMs % slot.unit_duration_ms) / slot.unit_duration_ms) * 100
    : 100
  const nextSecondsLeft = remaining > 0
    ? Math.max(0, Math.ceil((slot.unit_duration_ms - (elapsedMs % slot.unit_duration_ms)) / 1000))
    : 0
  return { completed, remaining, currentPct, nextSecondsLeft }
}

/* ── RefineryCard ──────────────────────────────────────────────────────────── */

function RefineryCard({
  building, recipes, inventory, slots, resources,
  onRefine, onCollectAll,
  anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending,
}) {
  const [showModal, setShowModal] = useState(false)
  const [optimisticEndsAt, setOptimisticEndsAt] = useState(null)
  const [, tick] = useReducer(x => x + 1, 0)

  // Tick cada segundo para actualizar barras de progreso
  useEffect(() => {
    if (slots.length === 0) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [slots.length])

  useEffect(() => {
    if (building.upgrade_ends_at) {
      setOptimisticEndsAt(null)
      setShowModal(false)
    }
  }, [building.upgrade_ends_at])

  const effectiveBuilding = optimisticEndsAt
    ? { ...building, upgrade_started_at: new Date().toISOString(), upgrade_ends_at: optimisticEndsAt }
    : building

  const { secondsLeft, loading, mountedRef } = useUpgradeTimer(effectiveBuilding, () => {
    setOptimisticEndsAt(null)
    onUpgradeCollect()
  })

  const meta = BUILDING_META[effectiveBuilding.type]
  if (!meta) return null

  const { level } = effectiveBuilding
  const hasUpgrade = !!effectiveBuilding.upgrade_ends_at
  const Icon = meta.icon

  const cost = buildingUpgradeCost(building.type, level)
  const totalSeconds = buildingUpgradeDurationMs(level, building.type) / 1000
  const elapsed = hasUpgrade ? totalSeconds - (secondsLeft ?? totalSeconds) : 0
  const upgradePct = hasUpgrade ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  async function handleUpgradeStart() {
    setOptimisticEndsAt(new Date(Date.now() + buildingUpgradeDurationMs(building.level, building.type)).toISOString())
    onOptimisticDeduct(cost)
    onUpgradePending(true)
    try {
      await apiPost('/api/building-upgrade-start', { buildingId: building.id })
      onUpgradeStart()
    } catch (err) {
      setOptimisticEndsAt(null)
      onOptimisticDeduct({ wood: -(cost.wood ?? 0), iron: -(cost.iron ?? 0), mana: -(cost.mana ?? 0) })
      onUpgradePending(false)
      notify.error(err.message)
    }
  }

  // Todas las recetas (sin niveles)
  const productOrder = (BUILDING_PRODUCTS[building.type] ?? []).map(p => p.id)
  const sorted = [...recipes].sort((a, b) => {
    const ai = productOrder.indexOf(a.id)
    const bi = productOrder.indexOf(b.id)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  const slotMap = Object.fromEntries(slots.map(s => [s.recipe_id, s]))

  // ¿Hay algo que recoger en este edificio?
  const totalCollectable = slots.reduce((sum, s) => {
    const p = slotProgress(s)
    return sum + p.completed
  }, 0)

  // Stock de productos de este edificio
  const products = BUILDING_PRODUCTS[building.type] ?? []

  return (
    <>
      <div
        className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-200"
        style={{ '--accent': meta.color }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: `color-mix(in srgb, ${meta.color} 14%, var(--surface-2))`,
              border: `1px solid color-mix(in srgb, ${meta.color} 25%, var(--border))`,
            }}
          >
            <Icon size={20} strokeWidth={1.8} color={meta.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-text leading-none truncate">{meta.name}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {level === 0 && (
                  <span className="text-[11px] font-bold text-text-3 bg-surface-2 border border-border rounded px-1.5 py-0.5 leading-none">
                    Sin construir
                  </span>
                )}
              </div>
            </div>
            {level > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {products.map(({ id, name }) => {
                  const qty = inventory?.[id] ?? 0
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 text-[12px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        color: qty > 0 ? meta.color : 'var(--text-3)',
                        background: qty > 0
                          ? `color-mix(in srgb, ${meta.color} 10%, var(--surface-2))`
                          : 'var(--surface-2)',
                        border: qty > 0
                          ? `1px solid color-mix(in srgb, ${meta.color} 25%, var(--border))`
                          : '1px solid var(--border)',
                      }}
                    >
                      <Warehouse size={10} strokeWidth={2} />
                      {qty} {name}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recipes (when built) ── */}
        {level > 0 && (
          <div className="px-4 py-3 flex flex-col gap-3 border-t border-border">
            {sorted.map(recipe => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                slot={slotMap[recipe.id]}
                inventory={inventory}
                resources={resources}
                onRefine={onRefine}
                color={meta.color}
              />
            ))}

            {/* Botón recoger todo — siempre visible */}
            <motion.button
              className="w-full py-2 rounded-lg font-bold text-[13px] border-0 text-white flex items-center justify-center gap-1.5 disabled:opacity-30"
              style={{
                background: totalCollectable > 0 ? '#059669' : 'var(--surface-2)',
                color: totalCollectable > 0 ? '#fff' : 'var(--text-3)',
              }}
              onClick={onCollectAll}
              disabled={totalCollectable === 0}
              whileTap={totalCollectable > 0 ? { scale: 0.97 } : {}}
            >
              <Check size={13} strokeWidth={2.5} />
              {totalCollectable > 0 ? `Recoger todo (${totalCollectable})` : 'Nada que recoger'}
            </motion.button>
          </div>
        )}

        {/* ── Build (level 0, no upgrade in progress) ── */}
        {level === 0 && !hasUpgrade && (
          <div className="px-4 pb-3.5 pt-2 border-t border-border">
            <p className="text-[13px] text-text-3 mb-3">{meta.description}</p>
            <motion.button
              className="w-full py-2.5 rounded-lg font-bold text-[14px] border-0 text-white"
              style={{ background: `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 75%, #000))` }}
              onClick={() => setShowModal(true)}
              whileTap={{ scale: 0.97 }}
            >
              Construir
            </motion.button>
          </div>
        )}

        {/* ── Upgrading progress (construction) ── */}
        {hasUpgrade && (
          <div className="px-4 pb-3 pt-2 border-t border-border flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold" style={{ color: meta.color }}>
                Construyendo...
              </span>
              <span className="flex items-center gap-1 text-[13px] font-semibold text-text-3">
                <Clock size={12} strokeWidth={2} />
                {loading ? 'Aplicando...' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
              </span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ background: meta.color, width: `${upgradePct}%`, transition: mountedRef.current ? 'width 1s linear' : 'none' }}
              />
            </div>
          </div>
        )}

      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {showModal && (
          <BuildingInfoModal
            building={building}
            resources={resources}
            anyUpgrading={anyUpgrading}
            onUpgradeStart={handleUpgradeStart}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/* ── RecipeRow ─────────────────────────────────────────────────────────────── */

function RecipeRow({ recipe, slot, inventory, resources, onRefine, color }) {
  const [qty, setQty] = useState(1)
  const inputs = recipe.inputs ?? []

  // Cuántas unidades puedo pagar
  const maxAffordable = inputs.length > 0
    ? Math.min(...inputs.map(inp => {
        const available = inp.resource ? (resources?.[inp.resource] ?? 0) : (inventory?.[inp.item] ?? 0)
        return Math.floor(available / inp.qty)
      }))
    : 99
  const canAfford = maxAffordable >= qty

  // Slot activo — progreso
  const progress = slot ? slotProgress(slot) : null

  function handleRefine() {
    if (!canAfford || qty < 1) return
    onRefine({ recipeId: recipe.id, quantity: qty })
    setQty(1)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Línea principal: icono, nombre, inputs, selector, botón */}
      <div className="flex items-center gap-2">
        <span className="text-[16px] flex-shrink-0">{recipe.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-text truncate">{recipe.name}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {inputs.map(inp => {
              const key = inp.resource ?? inp.item
              const needed = inp.qty * qty
              const available = inp.resource ? (resources?.[key] ?? 0) : (inventory?.[key] ?? 0)
              const has = available >= needed
              return (
                <span
                  key={key}
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    color: has ? 'var(--text-2)' : '#dc2626',
                    background: has ? 'var(--surface-2)' : 'color-mix(in srgb, #dc2626 8%, var(--surface))',
                  }}
                >
                  {needed} {INPUT_LABELS[key] ?? key}
                </span>
              )
            })}
            <span className="flex items-center gap-0.5 text-[11px] text-text-3">
              <Clock size={9} strokeWidth={2} />
              {recipe.craft_minutes}m
            </span>
          </div>
        </div>
        {/* Selector de cantidad + botón Refinar */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="w-6 h-6 flex items-center justify-center rounded bg-surface-2 border border-border text-text-3 disabled:opacity-30"
            onClick={() => setQty(q => Math.max(1, q - 1))}
            disabled={qty <= 1}
          >
            <Minus size={10} strokeWidth={2.5} />
          </button>
          <span className="w-6 text-center text-[12px] font-bold text-text tabular-nums">{qty}</span>
          <button
            className="w-6 h-6 flex items-center justify-center rounded bg-surface-2 border border-border text-text-3 disabled:opacity-30"
            onClick={() => setQty(q => Math.min(99, q + 1))}
            disabled={qty >= 99 || qty >= maxAffordable}
          >
            <Plus size={10} strokeWidth={2.5} />
          </button>
          <motion.button
            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border-0 text-white disabled:opacity-30"
            style={{ background: color }}
            onClick={handleRefine}
            disabled={!canAfford}
            whileTap={canAfford ? { scale: 0.95 } : {}}
          >
            Refinar
          </motion.button>
        </div>
      </div>

      {/* Barra de progreso — siempre visible */}
      <div className="flex items-center gap-2 ml-7">
        <div className="flex-1 flex flex-col gap-1">
          <div className="h-1.5 rounded-full overflow-hidden"
            style={{ background: `color-mix(in srgb, ${color} 12%, var(--surface-2))` }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-1000 linear"
              style={{ background: color, width: `${progress ? progress.currentPct : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] min-h-[16px]">
            <span className="text-text-3">
              {progress && progress.remaining > 0 ? (
                <span className="flex items-center gap-0.5">
                  <Clock size={9} strokeWidth={2} />
                  {fmtShort(progress.nextSecondsLeft)}
                  {slot.quantity > 1 && <span className="text-text-3 opacity-60"> · {progress.remaining} restantes</span>}
                </span>
              ) : progress && progress.remaining === 0 ? (
                <span className="font-semibold" style={{ color }}>Todo listo</span>
              ) : (
                <span className="text-text-3 opacity-40">Sin producción</span>
              )}
            </span>
            {progress && progress.completed > 0 && (
              <span className="font-bold" style={{ color }}>{progress.completed} listos</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── helpers locales ───────────────────────────────────────────────────────── */

function fmtShort(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}
