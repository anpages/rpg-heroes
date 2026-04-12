import { useState, useEffect, useRef } from 'react'
import { Clock, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../../lib/notifications.js'
import {
  buildingUpgradeCost, buildingUpgradeDurationMs, buildingRateAndCap,
  BUILDING_MAX_LEVEL,
} from '../../lib/gameConstants.js'
import { apiPost } from '../../lib/api.js'
import { BUILDING_META, SECONDARY_RESOURCE_ITEMS, RESOURCE_ITEMS } from './constants.js'
import { fmtTime } from './helpers.js'
import BuildingInfoModal from './BuildingInfoModal.jsx'

const SEC_META = Object.fromEntries(SECONDARY_RESOURCE_ITEMS.map(r => [r.key, r]))
const RES_META = Object.fromEntries(RESOURCE_ITEMS.map(r => [r.key, r]))

/* ── Upgrade timer ─────────────────────────────────────────────────────────── */

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

/* ── ProductionCard ────────────────────────────────────────────────────────── */

export default function ProductionCard({
  building,
  prod,
  resources,
  anyUpgrading,
  onCollect,
  onUpgradeStart,
  onUpgradeCollect,
  onOptimisticDeduct,
  onUpgradePending,
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
  const { rate, cap } = buildingRateAndCap(building.type, level)

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

  // Resource meta for primary
  const resMeta = RES_META[prod?.resource] ?? { label: meta.name, color: meta.color }

  return (
    <>
      <div
        className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-200"
        style={{ '--accent': meta.color }}
      >
        {/* ── Header: icon + name + level + info ── */}
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
              <p className="text-[13px] text-text-3 mt-1 leading-snug">{meta.description}</p>
            )}
          </div>
        </div>

        {/* ── Production: bars + collect (only when built) ── */}
        {prod && level > 0 && (
          <div className="px-4 py-3 flex flex-col gap-2.5">
            {/* Primary resource */}
            <ProductionBar
              label={resMeta.label}
              stored={prod.stored}
              cap={cap}
              rate={rate}
              pct={prod.pct}
              color={meta.color}
              fullAt={prod.fullAt}
            />

            {/* Secondary resource */}
            {prod.secondary && (() => {
              const secMeta = SEC_META[prod.secondary.resource]
              return (
                <ProductionBar
                  label={secMeta?.label ?? prod.secondary.resource}
                  stored={prod.secondary.stored}
                  cap={prod.secondary.cap}
                  rate={prod.secondary.rate}
                  pct={prod.secondary.pct}
                  color={secMeta?.color ?? '#94a3b8'}
                  small
                />
              )
            })()}

            {/* Collect button */}
            <motion.button
              className="w-full py-2.5 rounded-lg font-bold text-[14px] border-0 transition-opacity disabled:opacity-30"
              style={{
                background: prod.canCollect
                  ? `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 80%, #000))`
                  : `color-mix(in srgb, ${meta.color} 12%, var(--surface-2))`,
                color: prod.canCollect ? '#fff' : 'var(--text-3)',
              }}
              onClick={() => onCollect(building.type)}
              disabled={!prod.canCollect}
              whileTap={prod.canCollect ? { scale: 0.97 } : {}}
            >
              {prod.canCollect ? 'Recolectar' : 'Almacen vacio'}
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
                style={{
                  background: meta.color,
                  width: `${upgradePct}%`,
                  transition: mountedRef.current ? 'width 1s linear' : 'none',
                }}
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

/* ── ProductionBar ─────────────────────────────────────────────────────────── */

function ProductionBar({ label, stored, cap, rate, pct, color, fullAt, small }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={`font-semibold text-text-2 ${small ? 'text-[12px]' : 'text-[14px]'}`}>
          {label}
          <span className="text-text-3 font-normal ml-1.5">{stored} / {cap}</span>
        </span>
        <span className={`text-text-3 ${small ? 'text-[11px]' : 'text-[12px]'}`}>
          {rate}/h
          {!small && fullAt && pct < 100 && (
            <span className="ml-1.5">· lleno en {formatTimeUntil(fullAt)}</span>
          )}
          {!small && pct >= 100 && (
            <span className="ml-1.5 font-semibold" style={{ color }}>· Lleno</span>
          )}
        </span>
      </div>
      <div className={`${small ? 'h-2' : 'h-2.5'} rounded-full overflow-hidden`}
        style={{ background: `color-mix(in srgb, ${color} 12%, var(--surface-2))` }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  )
}

function formatTimeUntil(date) {
  const ms = date.getTime() - Date.now()
  if (ms <= 0) return 'listo'
  const mins = Math.ceil(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
