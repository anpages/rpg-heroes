import { useState, useEffect, useRef } from 'react'
import { ArrowUpCircle, Check, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../../lib/notifications.js'
import {
  buildingUpgradeCost, buildingUpgradeDurationMs, buildingRate,
  BUILDING_MAX_LEVEL,
} from '../../lib/gameConstants.js'
import { apiPost } from '../../lib/api.js'
import { BUILDING_META } from './constants.js'
import { fmtTime } from './helpers.js'
import BuildingInfoModal from './BuildingInfoModal.jsx'

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
  const { rate } = buildingRate(building.type, level)

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
        className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-200"
        style={{ '--accent': meta.color }}
      >
        {/* ── Header: icon + name + level + stock ── */}
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
                {level > 0 && !hasUpgrade && (
                  isMaxLevel ? (
                    <span
                      className="w-7 h-7 flex items-center justify-center rounded-lg border"
                      style={{
                        background: `color-mix(in srgb, ${meta.color} 12%, var(--surface-2))`,
                        borderColor: `color-mix(in srgb, ${meta.color} 30%, var(--border))`,
                        color: meta.color,
                      }}
                    >
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-lg border transition-colors"
                      style={{
                        background: `color-mix(in srgb, ${meta.color} 8%, var(--surface-2))`,
                        borderColor: `color-mix(in srgb, ${meta.color} 25%, var(--border))`,
                        color: meta.color,
                      }}
                      onClick={() => setShowModal(true)}
                    >
                      <ArrowUpCircle size={14} strokeWidth={2} />
                    </button>
                  )
                )}
              </div>
            </div>
            {level > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[13px] text-text-3">Nv.{level}</span>
                <span className="text-[12px] text-text-3">·</span>
                <span className="text-[12px] text-text-3">{rate}/h</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Production: capacity bar + collect ── */}
        {prod && level > 0 && (
          <div className="px-4 py-3 flex flex-col gap-2.5 border-t border-border">
            <CapacityBar
              stored={prod.stored}
              cap={prod.cap}
              fillPct={prod.fillPct}
              isFull={prod.isFull}
              secondsToFull={prod.secondsToFull}
              color={meta.color}
            />

            <motion.button
              className="w-full py-2 rounded-lg font-bold text-[13px] border-0 disabled:opacity-30 flex items-center justify-center gap-1.5"
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
              {prod.canCollect ? `Recoger ${prod.stored}` : 'Llenando…'}
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

/* ── CapacityBar (barra de almacén) ──────────────────────────────────────── */

function CapacityBar({ stored, cap, fillPct, isFull, secondsToFull, color }) {
  const barRef = useRef(null)
  const prevPct = useRef(fillPct)

  useEffect(() => {
    if (fillPct < prevPct.current - 5 && barRef.current) {
      barRef.current.style.transition = 'none'
      barRef.current.style.width = `${Math.min(100, fillPct)}%`
      void barRef.current.offsetWidth
      barRef.current.style.transition = 'width 1.8s linear'
    }
    prevPct.current = fillPct
  })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-text-2">
          {stored} <span className="text-text-3 font-normal">/ {cap}</span>
        </span>
        <span className="text-[12px] text-text-3 flex items-center gap-0.5">
          {isFull ? (
            <span className="font-semibold" style={{ color }}>Almacén lleno</span>
          ) : (
            <>
              <Clock size={10} strokeWidth={2} />
              {fmtShort(secondsToFull)}
            </>
          )}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden"
        style={{ background: `color-mix(in srgb, ${color} 12%, var(--surface-2))` }}
      >
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{
            background: isFull
              ? `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, #f59e0b))`
              : color,
            width: `${Math.min(100, fillPct)}%`,
            transition: 'width 1.8s linear',
          }}
        />
      </div>
    </div>
  )
}

function fmtShort(secs) {
  if (secs <= 0) return '0s'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `${s}s`
}
