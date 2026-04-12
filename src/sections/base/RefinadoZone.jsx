import { useState, useEffect, useRef, useReducer } from 'react'
import { Clock, Lock, Check, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../../lib/notifications.js'
import {
  buildingUpgradeCost, buildingUpgradeDurationMs,
  BUILDING_MAX_LEVEL, REFINING_SLOTS_BASE, REFINING_SLOTS_EXPANDED_LEVEL,
} from '../../lib/gameConstants.js'
import { apiPost } from '../../lib/api.js'
import { BUILDING_META, UNLOCK_REQUIREMENTS } from './constants.js'
import { fmtTime } from './helpers.js'
import { LockedBuildingCard } from './BuildingCard.jsx'
import { cardVariants } from './constants.js'
import BuildingInfoModal from './BuildingInfoModal.jsx'

const REFINING_BUILDINGS = ['carpinteria', 'fundicion', 'destileria_arcana', 'herbolario']

const INPUT_LABELS = {
  iron: 'Hierro', wood: 'Madera', mana: 'Mana', herbs: 'Hierbas',
  coal: 'Carbon', fiber: 'Fibra', arcane_dust: 'Polvo Arcano', flowers: 'Flores',
}

/* ── RefinadoZone ──────────────────────────────────────────────────────────── */

export default function RefinadoZone({
  byType, effectiveResources, catalog, inventory, queue,
  onCraft, onCollect,
  anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending,
}) {
  return (
    <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-3" variants={cardVariants} initial="initial" animate="animate">
      {REFINING_BUILDINGS.map(type => {
        const b = byType[type]
        if (!b) return null
        if (b.unlocked === false) return <LockedBuildingCard key={type} type={type} />

        const buildingQueue = (queue ?? []).filter(q => q.building_type === type)
        const recipes = (catalog ?? []).filter(c => c.refinery_type === type)

        return (
          <RefineryCard
            key={b.id}
            building={b}
            recipes={recipes}
            inventory={inventory}
            queue={buildingQueue}
            resources={effectiveResources}
            onCraft={onCraft}
            onCollect={onCollect}
            anyUpgrading={anyUpgrading}
            onUpgradeStart={onUpgradeStart}
            onUpgradeCollect={onUpgradeCollect}
            onOptimisticDeduct={onOptimisticDeduct}
            onUpgradePending={onUpgradePending}
          />
        )
      })}
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

/* ── RefineryCard ──────────────────────────────────────────────────────────── */

function RefineryCard({
  building, recipes, inventory, queue, resources,
  onCraft, onCollect,
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

  const meta = BUILDING_META[effectiveBuilding.type]
  if (!meta) return null

  const { level } = effectiveBuilding
  const hasUpgrade = !!effectiveBuilding.upgrade_ends_at
  const isMaxLevel = level >= BUILDING_MAX_LEVEL
  const Icon = meta.icon

  const maxSlots = level >= REFINING_SLOTS_EXPANDED_LEVEL ? 2 : REFINING_SLOTS_BASE
  const slotsUsed = queue.length
  const slotsAvailable = slotsUsed < maxSlots

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

  // Filtrar recetas disponibles segun nivel del edificio
  const availableRecipes = recipes.filter(r => level >= (r.min_refinery_level ?? 1))
  const lockedRecipes = recipes.filter(r => level < (r.min_refinery_level ?? 1))

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
                {level > 0 && (
                  <span className="text-[11px] font-semibold text-text-3">
                    {slotsUsed}/{maxSlots} slots
                  </span>
                )}
                {level === 0 ? (
                  <span className="text-[11px] font-bold text-text-3 bg-surface-2 border border-border rounded px-1.5 py-0.5 leading-none">
                    Sin construir
                  </span>
                ) : (
                  <span
                    className="text-[12px] font-bold rounded px-1.5 py-0.5 leading-none"
                    style={{
                      color: meta.color,
                      background: `color-mix(in srgb, ${meta.color} 10%, var(--surface-2))`,
                      border: `1px solid color-mix(in srgb, ${meta.color} 25%, var(--border))`,
                    }}
                  >
                    Nv.{level}
                  </span>
                )}
                {!hasUpgrade && (
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-2 border border-border text-text-3 hover:text-text transition-colors"
                    onClick={() => setShowModal(true)}
                  >
                    <Info size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
            {level > 0 && (
              <p className="text-[13px] text-text-3 mt-1 leading-snug">{meta.effect(level)}</p>
            )}
          </div>
        </div>

        {/* ── Queue (active crafts) ── */}
        {queue.length > 0 && (
          <div className="px-4 py-2 flex flex-col gap-1.5">
            {queue.map(craft => (
              <QueueItem
                key={craft.id}
                craft={craft}
                recipes={recipes}
                onCollect={onCollect}
              />
            ))}
          </div>
        )}

        {/* ── Recipes (when built) ── */}
        {level > 0 && (
          <div className="px-4 py-3 flex flex-col gap-2.5 border-t border-border">
            {availableRecipes.map(recipe => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                inventory={inventory}
                resources={resources}
                slotsAvailable={slotsAvailable}
                onCraft={onCraft}
                color={meta.color}
              />
            ))}
            {lockedRecipes.map(recipe => (
              <div key={recipe.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md opacity-40">
                <span className="text-[15px]">{recipe.icon}</span>
                <span className="text-[13px] font-semibold text-text-3 truncate">{recipe.name}</span>
                <span className="flex items-center gap-1 ml-auto text-[11px] text-text-3 flex-shrink-0">
                  <Lock size={10} strokeWidth={2.5} />
                  Nv.{recipe.min_refinery_level}
                </span>
              </div>
            ))}
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

        {/* ── Upgrading progress ── */}
        {hasUpgrade && (
          <div className="px-4 pb-3 pt-2 border-t border-border flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold" style={{ color: meta.color }}>
                Mejorando a Nv.{level + 1}
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

        {/* ── Max level ── */}
        {isMaxLevel && !hasUpgrade && (
          <div className="px-4 py-2 border-t border-border">
            <span className="text-[11px] font-bold text-text-3 uppercase tracking-[0.08em]">Nivel maximo</span>
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

/* ── QueueItem ─────────────────────────────────────────────────────────────── */

function QueueItem({ craft, recipes, onCollect }) {
  const [, tick] = useReducer(x => x + 1, 0)
  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const recipe = recipes.find(r => r.id === craft.recipe_id)
  const ready = new Date(craft.craft_ends_at) <= new Date()
  const ms = new Date(craft.craft_ends_at).getTime() - Date.now()
  const secs = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(secs / 60)
  const s = secs % 60

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[15px]">{recipe?.icon ?? '🔧'}</span>
        <span className="text-[13px] font-semibold text-text-2 truncate">
          {recipe?.name ?? craft.recipe_id}
        </span>
      </div>
      {ready ? (
        <motion.button
          className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-bold rounded-md border-0 text-white bg-emerald-600 disabled:opacity-50"
          onClick={() => onCollect(craft.id)}
          whileTap={{ scale: 0.95 }}
        >
          <Check size={11} strokeWidth={3} />
          Recoger
        </motion.button>
      ) : (
        <span className="flex items-center gap-1 text-[12px] text-text-3 font-medium flex-shrink-0">
          <Clock size={11} strokeWidth={2} />
          {m}:{String(s).padStart(2, '0')}
        </span>
      )}
    </div>
  )
}

/* ── RecipeRow ─────────────────────────────────────────────────────────────── */

function RecipeRow({ recipe, inventory, resources, slotsAvailable, onCraft, color }) {
  const inputs = recipe.inputs ?? []
  const qty = inventory?.[recipe.id] ?? 0

  const canAfford = inputs.every(inp => {
    if (inp.resource) return (resources?.[inp.resource] ?? 0) >= inp.qty
    if (inp.item)     return (inventory?.[inp.item] ?? 0) >= inp.qty
    return false
  })
  const canCraft = canAfford && slotsAvailable

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[16px] flex-shrink-0">{recipe.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-text truncate">{recipe.name}</span>
          {qty > 0 && <span className="text-[11px] text-text-3 font-medium">x{qty}</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {inputs.map(inp => {
            const key = inp.resource ?? inp.item
            const needed = inp.qty
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
            <Clock size={9} strokeWidth={2} />{recipe.craft_minutes}m
          </span>
        </div>
      </div>
      <motion.button
        className="px-3 py-1.5 text-[12px] font-bold rounded-lg border-0 text-white transition-opacity disabled:opacity-30 flex-shrink-0"
        style={{ background: color }}
        onClick={() => onCraft(recipe.id)}
        disabled={!canCraft}
        whileTap={canCraft ? { scale: 0.95 } : {}}
      >
        Refinar
      </motion.button>
    </div>
  )
}
