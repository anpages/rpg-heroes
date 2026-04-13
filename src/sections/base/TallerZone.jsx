import { useState, useEffect, useReducer, useRef } from 'react'
import { Clock, Lock, Check, Minus, Plus, Warehouse } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../../lib/notifications.js'
import {
  buildingUpgradeCost, buildingUpgradeDurationMs,
  LAB_BASE_LEVEL_REQUIRED,
} from '../../lib/gameConstants.js'
import { apiPost } from '../../lib/api.js'
import { BUILDING_META } from './constants.js'
import { fmtTime, baseLevelFromMap } from './helpers.js'
import { cardVariants } from './constants.js'
import BuildingInfoModal from './BuildingInfoModal.jsx'

const CATEGORY_ORDER = ['potion', 'repair', 'forge']

const CATEGORY_META = {
  potion: { label: 'Pociones', color: '#059669' },
  repair: { label: 'Reparación', color: '#b45309' },
  forge:  { label: 'Mejora', color: '#6d28d9' },
}

const INPUT_LABELS = {
  iron: 'Hierro', wood: 'Madera', mana: 'Maná', herbs: 'Hierbas',
  fragments: 'Fragmentos', essence: 'Esencia',
  steel_ingot: 'Lingote', plank: 'Tablón', mana_crystal: 'Cristal', herbal_extract: 'Extracto',
  tempered_steel: 'Acero Templ.', composite_wood: 'Madera Comp.', concentrated_mana: 'Maná Conc.', potion_base: 'Base Poc.',
  hp_potion_minor: 'Poc. Vida Menor', repair_kit: 'Kit Reparación', forge_stone_t2: 'Piedra T2',
}

// Orden explícito dentro de cada categoría: menor primero, mayor después
const RECIPE_ORDER = [
  'hp_potion_minor', 'atk_elixir', 'def_elixir', 'hp_potion_major',
  'repair_kit', 'repair_kit_full',
  'forge_stone_t2', 'forge_stone_t3',
]

/* ── Helpers ──────────────────────────────────────────────────────────────── */

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

function fmtShort(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

/* ── TallerZone ──────────────────────────────────────────────────────────── */

export default function TallerZone({
  byType, effectiveResources, catalog, inventory, refiningSlots,
  onRefine, onCollectSlot,
  anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending,
}) {
  const lab = byType['laboratory']
  const baseLevel = baseLevelFromMap(byType)
  const [, tick] = useReducer(x => x + 1, 0)

  // Tick para actualizar barras
  const labSlots = (refiningSlots ?? []).filter(s => s.building_type === 'laboratory')
  useEffect(() => {
    if (labSlots.length === 0) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [labSlots.length])

  if (!lab) return null

  // Locked state
  if (lab.level === 0 && !lab.upgrade_ends_at && baseLevel < LAB_BASE_LEVEL_REQUIRED) {
    const meta = BUILDING_META['laboratory']
    const Icon = meta.icon
    return (
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <div
          className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] opacity-60"
          style={{ '--accent': meta.color }}
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
              <Icon size={18} strokeWidth={1.8} color={meta.color} />
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-text truncate">{meta.name}</h3>
              <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 py-3 border-y border-border bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
            <p className="text-[13px] text-text-3 text-center">{meta.description}</p>
          </div>
          <div className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3">
              <Lock size={11} strokeWidth={2.5} />
              Requiere base nivel {LAB_BASE_LEVEL_REQUIRED} para construir.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  const recipes = (catalog ?? []).filter(c => c.refinery_type === 'laboratory')
  const slotMap = Object.fromEntries(labSlots.map(s => [s.recipe_id, s]))

  // Agrupar por categoría y ordenar menor→mayor
  const byCategory = {}
  for (const r of recipes) {
    const cat = r.category || 'other'
    ;(byCategory[cat] ??= []).push(r)
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) =>
      (RECIPE_ORDER.indexOf(a.id) === -1 ? 99 : RECIPE_ORDER.indexOf(a.id)) -
      (RECIPE_ORDER.indexOf(b.id) === -1 ? 99 : RECIPE_ORDER.indexOf(b.id))
    )
  }

  const { level } = lab
  const hasUpgrade = !!lab.upgrade_ends_at

  // Build/upgrade state
  if (level === 0 || hasUpgrade) {
    return (
      <motion.div className="flex flex-col gap-3" variants={cardVariants} initial="initial" animate="animate">
        <BuildCard
          building={lab}
          anyUpgrading={anyUpgrading}
          onUpgradeStart={onUpgradeStart}
          onUpgradeCollect={onUpgradeCollect}
          onOptimisticDeduct={onOptimisticDeduct}
          onUpgradePending={onUpgradePending}
        />
      </motion.div>
    )
  }

  return (
    <motion.div className="flex flex-col gap-3" variants={cardVariants} initial="initial" animate="animate">
      {CATEGORY_ORDER.map(cat => {
        const catRecipes = byCategory[cat]
        if (!catRecipes?.length) return null
        const catMeta = CATEGORY_META[cat]

        return (
          <div
            key={cat}
            className="rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)]"
          >
            {/* Category header */}
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: `color-mix(in srgb, ${catMeta.color} 6%, var(--surface))` }}
            >
              <span
                className="text-[12px] font-bold uppercase tracking-[0.08em]"
                style={{ color: catMeta.color }}
              >
                {catMeta.label}
              </span>
            </div>

            {/* Recipes — 2 cols on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {catRecipes.map((recipe, idx) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  slot={slotMap[recipe.id]}
                  inventory={inventory}
                  resources={effectiveResources}
                  onRefine={onRefine}
                  onCollectSlot={onCollectSlot}
                  color={catMeta.color}
                  hasBorderTop={idx > 0 && idx < 2}
                  hasBorderLeft={idx % 2 === 1}
                />
              ))}
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}

/* ── BuildCard (level 0 / upgrading) ──────────────────────────────────────── */

function BuildCard({
  building,
  anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending,
}) {
  const [showModal, setShowModal] = useState(false)
  const [optimisticEndsAt, setOptimisticEndsAt] = useState(null)

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

  const meta = BUILDING_META['laboratory']
  const Icon = meta.icon
  const hasUpgrade = !!effectiveBuilding.upgrade_ends_at
  const { level } = effectiveBuilding

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

  return (
    <>
      <div
        className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)]"
        style={{ '--accent': meta.color }}
      >
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
            <h3 className="text-[15px] font-bold text-text leading-none truncate">{meta.name}</h3>
          </div>
        </div>

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

        {hasUpgrade && (
          <div className="px-4 pb-3 pt-2 border-t border-border flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold" style={{ color: meta.color }}>Construyendo...</span>
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

      <AnimatePresence>
        {showModal && (
          <BuildingInfoModal
            building={building}
            resources={{}}
            anyUpgrading={anyUpgrading}
            onUpgradeStart={handleUpgradeStart}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/* ── useUpgradeTimer ──────────────────────────────────────────────────────── */

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

/* ── RecipeCard ───────────────────────────────────────────────────────────── */

function RecipeCard({ recipe, slot, inventory, resources, onRefine, onCollectSlot, color, hasBorderLeft }) {
  const [qty, setQty] = useState(1)
  const inputs = recipe.inputs ?? []
  const stock = inventory?.[recipe.id] ?? 0

  const maxAffordable = inputs.length > 0
    ? Math.min(...inputs.map(inp => {
        const available = inp.resource ? (resources?.[inp.resource] ?? 0) : (inventory?.[inp.item] ?? 0)
        return Math.floor(available / inp.qty)
      }))
    : 99
  const canAfford = maxAffordable >= qty

  const progress = slot ? slotProgress(slot) : null
  const canCollect = progress && progress.completed > 0

  function handleRefine() {
    if (!canAfford || qty < 1) return
    onRefine({ recipeId: recipe.id, quantity: qty })
    setQty(1)
  }

  return (
    <div className={`px-4 py-3 flex flex-col gap-1.5 border-t border-border ${hasBorderLeft ? 'sm:border-l' : ''}`}>

      {/* Línea principal: icono, nombre+inputs, controles */}
      <div className="flex items-center gap-2">
        <span className="text-[16px] flex-shrink-0">{recipe.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-text truncate">{recipe.name}</span>
            <span
              className="flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded flex-shrink-0"
              style={{
                color: stock > 0 ? color : 'var(--text-3)',
                background: stock > 0 ? `color-mix(in srgb, ${color} 10%, var(--surface-2))` : 'var(--surface-2)',
                border: `1px solid ${stock > 0 ? `color-mix(in srgb, ${color} 25%, var(--border))` : 'var(--border)'}`,
              }}
            >
              <Warehouse size={9} strokeWidth={2} />{stock}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {inputs.map(inp => {
              const key = inp.resource ?? inp.item
              const needed = inp.qty * qty
              const available = inp.resource ? (resources?.[key] ?? 0) : (inventory?.[key] ?? 0)
              const has = available >= needed
              return (
                <span key={key} className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
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
              <Clock size={9} strokeWidth={2} />{recipe.craft_minutes}m
            </span>
          </div>
        </div>
        {/* Controles qty + Max + Craftear */}
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
          <button
            className="px-1.5 py-1 text-[10px] font-bold rounded border border-border bg-surface-2 text-text-3 disabled:opacity-30"
            onClick={() => setQty(Math.min(99, maxAffordable))}
            disabled={maxAffordable <= 0 || qty >= Math.min(99, maxAffordable)}
          >
            Max
          </button>
          <motion.button
            className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border-0 text-white disabled:opacity-30"
            style={{ background: color }}
            onClick={handleRefine}
            disabled={!canAfford}
            whileTap={canAfford ? { scale: 0.95 } : {}}
          >
            Craftear
          </motion.button>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="flex flex-col gap-1 ml-7">
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
                {slot.quantity > 1 && <span className="opacity-60"> · {progress.remaining} restantes</span>}
              </span>
            ) : progress && progress.remaining === 0 ? (
              <span className="font-semibold" style={{ color }}>Todo listo</span>
            ) : (
              <span className="opacity-40">Sin producción</span>
            )}
          </span>
          {canCollect && (
            <motion.button
              className="flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] text-white"
              style={{ background: '#059669' }}
              onClick={() => onCollectSlot(slot.id)}
              whileTap={{ scale: 0.95 }}
            >
              <Check size={10} strokeWidth={2.5} />
              Recoger {progress.completed}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
