import { useState, useEffect, useRef } from 'react'
import { Clock, Lock, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notify } from '../../lib/notifications.js'
import { buildingUpgradeCost, buildingUpgradeDurationMs, BUILDING_MAX_LEVEL } from '../../lib/gameConstants.js'
import { apiPost } from '../../lib/api.js'
import { BUILDING_META, UNLOCK_REQUIREMENTS } from './constants.js'
import { fmtTime } from './helpers.js'
import BuildingInfoModal from './BuildingInfoModal.jsx'

/* ── useUpgradeTimer ────────────────────────────────────────────────────────── */

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

/* ── BuildingCard ───────────────────────────────────────────────────────────── */

export function BuildingCard({ building, resources, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending, anyUpgrading }) {
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

  const meta = BUILDING_META[effectiveBuilding.type]
  const { level } = effectiveBuilding
  const hasUpgrade = !!effectiveBuilding.upgrade_ends_at
  const isMaxLevel = level >= BUILDING_MAX_LEVEL
  const { secondsLeft, loading, mountedRef } = useUpgradeTimer(effectiveBuilding, () => {
    setOptimisticEndsAt(null)
    onUpgradeCollect()
  })

  if (!meta) return null

  const cost = buildingUpgradeCost(building.type, level)
  const Icon = meta.icon
  const totalSeconds = buildingUpgradeDurationMs(level, building.type) / 1000
  const elapsed = hasUpgrade ? totalSeconds - (secondsLeft ?? totalSeconds) : 0
  const pct = hasUpgrade ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

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
        className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--accent-border)] transition-[box-shadow,border-color] duration-200"
        style={{ '--accent': meta.color }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
            <Icon size={20} strokeWidth={1.8} color={meta.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-text leading-none truncate">{meta.name}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {level === 0 ? (
                  <span className="text-[11px] font-bold text-text-3 bg-surface-2 border border-border rounded-[5px] px-1.5 py-[3px] leading-none">
                    Sin construir
                  </span>
                ) : (
                  <span className="text-[12px] font-bold text-[var(--accent)] bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-[5px] px-1.5 py-[3px] leading-none">
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
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {level === 0 ? (
                <span className="text-[13px] font-semibold text-text-3">{meta.nextEffect(0)}</span>
              ) : (
                <span className="text-[13px] font-semibold text-text-2">{meta.effect(level)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade progress / Build button / Max level */}
        <div className="px-4 pb-4 border-t border-border">
          {hasUpgrade ? (
            <div className="flex flex-col gap-2 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[var(--accent)]">Mejorando a Nv.{level + 1}</span>
                <span className="flex items-center gap-1 text-[13px] font-semibold text-text-3">
                  <Clock size={12} strokeWidth={2} />
                  {loading ? 'Aplicando...' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
                </span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full"
                  style={{ width: `${pct}%`, transition: mountedRef.current ? 'width 1s linear' : 'none' }}
                />
              </div>
            </div>
          ) : isMaxLevel ? (
            <div className="flex items-center justify-center pt-3">
              <span className="text-[12px] font-bold text-text-3 uppercase tracking-[0.08em]">Nivel maximo</span>
            </div>
          ) : (
            <div className="pt-3">
              {level === 0 ? (
                <motion.button
                  className="w-full py-2.5 rounded-lg font-bold text-[14px] border-0 text-white"
                  style={{ background: `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 75%, #000))` }}
                  onClick={() => setShowModal(true)}
                  whileTap={{ scale: 0.97 }}
                >
                  Construir
                </motion.button>
              ) : (
                <motion.button
                  className="w-full py-2.5 rounded-lg font-bold text-[13px] border border-border bg-surface-2 text-text-2"
                  onClick={() => setShowModal(true)}
                  whileTap={{ scale: 0.97 }}
                >
                  Ver mejora a Nv.{level + 1}
                </motion.button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
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

/* ── LockedBuildingCard ─────────────────────────────────────────────────────── */

export function LockedBuildingCard({ type }) {
  const meta = BUILDING_META[type]
  const req  = UNLOCK_REQUIREMENTS[type] ?? { name: 'Requisito pendiente', level: '?' }
  if (!meta) return null
  const Icon = meta.icon
  return (
    <div
      className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] h-full opacity-40 pointer-events-none"
      style={{ '--accent': meta.color }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-[8px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
          <Icon size={20} strokeWidth={1.8} color={meta.color} />
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-bold text-text truncate">{meta.name}</h3>
          <Lock size={14} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-3 border-y border-border bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
        <p className="text-[13px] text-text-3 text-center">{meta.description}</p>
      </div>
      <div className="px-4 py-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-text-3">
          <Lock size={12} strokeWidth={2.5} />
          Requiere {req.name} Nv.{req.level}
        </p>
      </div>
    </div>
  )
}
