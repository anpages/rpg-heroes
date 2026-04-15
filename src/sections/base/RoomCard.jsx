import { useState, useEffect, useRef, useReducer } from 'react'
import { Axe, Pickaxe, Clock, Lock, ChevronRight, X, TrendingUp, PackageOpen, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  xpRateForLevel,
  trainingRoomUpgradeCost, trainingRoomUpgradeDurationMs,
  TRAINING_ROOM_MAX_LEVEL,
} from '../../lib/gameConstants.js'
import { xpThreshold } from '../../hooks/useTraining.js'
import { fmt, fmtTime } from './helpers.js'

const EASE_OUT = [0.22, 1, 0.36, 1]
const EASE_IN  = [0.55, 0, 0.75, 0.06]

const sheetVariants = {
  initial: { y: '100%' },
  animate: { y: 0,      transition: { type: 'tween', ease: EASE_OUT, duration: 0.26 } },
  exit:    { y: '100%', transition: { type: 'tween', ease: EASE_IN,  duration: 0.18 } },
}

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

function fmtDuration(secs) {
  if (secs <= 0) return '0s'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

export default function RoomCard({ room, roomData, progressRow, resources, heroLevel, mutPending, isQueueBusy, anyReady, collectPending, onBuild, onUpgrade, onUpgradeCollect, onCollect }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const collectingRef = useRef(false)
  const [, tick] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  const Icon             = room.icon
  const isBuilt          = !!roomData?.built_at
  const building_ends_at = roomData?.building_ends_at ?? null
  const isUpgrading      = isBuilt && !!building_ends_at
  const roomLevel        = roomData?.level ?? 1
  const lockedByLevel    = !roomData && heroLevel < room.heroLevelMin

  // Timer de mejora
  useEffect(() => {
    if (!isUpgrading) { setSecondsLeft(null); collectingRef.current = false; return }
    const endTime = new Date(building_ends_at)
    function update() {
      const rem = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setSecondsLeft(rem)
      if (rem === 0 && !collectingRef.current) {
        collectingRef.current = true
        onUpgradeCollect()
      }
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building_ends_at])

  const rate    = xpRateForLevel(isBuilt ? roomLevel : 1)
  const thr     = xpThreshold(progressRow?.total_gained ?? 0)

  const xp = isBuilt && progressRow && !isUpgrading
    ? (() => {
        const hoursToThr   = Math.max(0, (thr - progressRow.xp_bank) / rate)
        const refTime      = Math.max(
          new Date(progressRow.last_collected_at).getTime(),
          new Date(roomData.built_at).getTime(),
        )
        const hoursElapsed = (Date.now() - refTime) / 3_600_000
        return progressRow.xp_bank + Math.min(hoursElapsed, hoursToThr) * rate
      })()
    : (progressRow?.xp_bank ?? 0)

  const xpPct       = isBuilt && progressRow ? Math.min(100, Math.round((xp / thr) * 100)) : 0
  const ready       = isBuilt && progressRow && !isUpgrading ? xp >= thr : false
  const secsToNext  = isBuilt && progressRow && !ready && !isUpgrading
    ? Math.max(0, Math.round((thr - xp) / rate * 3600))
    : 0
  const hoursPerPoint = thr / rate

  const upgCost   = trainingRoomUpgradeCost(roomLevel)
  const canAfford = resources ? resources.wood >= upgCost.wood && resources.iron >= upgCost.iron : false

  const upgradeDurSec = isUpgrading ? trainingRoomUpgradeDurationMs(roomLevel - 1) / 1000 : 0
  const upgradeElapsed = upgradeDurSec - (secondsLeft ?? upgradeDurSec)
  const upgradePct = upgradeDurSec > 0 ? Math.min(100, Math.round((upgradeElapsed / upgradeDurSec) * 100)) : 0

  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden transition-[border-color] duration-200 ${
        lockedByLevel
          ? 'border-dashed border-border bg-surface opacity-50 pointer-events-none'
          : ready
            ? 'border-border bg-surface shadow-[var(--shadow-sm)]'
            : 'border-border bg-surface'
      }`}
      style={ready ? { borderColor: `color-mix(in srgb,${room.color} 40%,var(--border))` } : {}}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb,${room.color} ${isBuilt ? '15%' : '8%'},var(--surface-2))` }}
        >
          <Icon size={18} strokeWidth={isBuilt ? 2 : 1.5} style={{ color: isBuilt ? room.color : 'var(--text-3)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[14px] font-bold leading-none ${isBuilt ? 'text-text' : 'text-text-3'}`}>
              {room.label}
            </p>
            {isBuilt && !isUpgrading && (
              <span className="text-[11px] font-bold px-1.5 py-[3px] rounded-md leading-none flex-shrink-0"
                style={{ color: room.color, background: `color-mix(in srgb,${room.color} 12%,var(--surface))` }}>
                Nv.{roomLevel}
              </span>
            )}
            {isUpgrading && (
              <span className="text-[11px] font-semibold text-[#0891b2] flex-shrink-0">Mejorando…</span>
            )}
            {!isBuilt && lockedByLevel && (
              <span className="text-[11px] text-text-3 flex-shrink-0 flex items-center gap-1">
                <Lock size={10} strokeWidth={2.5} />Héroe Nv.{room.heroLevelMin}
              </span>
            )}
            {!isBuilt && !lockedByLevel && (
              <span className="text-[11px] text-text-3 flex-shrink-0">Disponible</span>
            )}
          </div>

          <p className="text-[11px] text-text-3 mt-0.5">
            {isBuilt && !isUpgrading
              ? `+1 cada ~${fmtDuration(Math.round(hoursPerPoint * 3600))}`
              : isUpgrading
                ? 'Pausado durante la mejora'
                : `+1 cada ~${fmtDuration(Math.round(xpThreshold(0) / xpRateForLevel(1) * 3600))} al activar`
            }
          </p>
        </div>
      </div>

      {/* Progreso XP */}
      {isBuilt && !isUpgrading && (
        <div className="px-4 pb-3 border-t border-border pt-3 flex flex-col gap-2">
          <div className="h-2 rounded-full overflow-hidden bg-border">
            <div
              className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
              style={{ width: `${xpPct}%`, background: ready ? `linear-gradient(90deg,${room.color},color-mix(in srgb,${room.color} 70%,#f59e0b))` : room.color }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold" style={{ color: ready ? room.color : 'var(--text-3)' }}>
              {ready ? '¡Punto listo!' : `${xpPct}%`}
            </span>
            {!ready && secsToNext > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-text-3">
                <Clock size={10} strokeWidth={2} />
                {fmtDuration(secsToNext)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Mejora en curso */}
      {isUpgrading && (
        <div className="px-4 pb-3 border-t border-border pt-3 flex flex-col gap-2">
          <div className="h-2 rounded-full overflow-hidden bg-border">
            <div className="h-full rounded-full bg-[#0891b2] transition-[width] duration-[1000ms] linear"
              style={{ width: `${upgradePct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-3">Mejora en curso</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#0891b2]">
              <Clock size={10} strokeWidth={2} />
              {secondsLeft !== null ? fmtTime(secondsLeft) : '…'}
            </span>
          </div>
        </div>
      )}

      {/* No activada */}
      {!isBuilt && !lockedByLevel && (
        <div className="px-4 pb-3 border-t border-border pt-3">
          <p className="text-[12px] text-text-3 leading-relaxed">
            Genera +1 a {room.label.toLowerCase()} de forma pasiva.
          </p>
        </div>
      )}

      {/* Acción */}
      {!isUpgrading && (
        <div className="px-4 pb-4 mt-auto">
          {ready ? (
            <div className="flex items-center justify-end pt-3 border-t border-border">
              <motion.button
                className="btn btn--primary btn--sm"
                onClick={onCollect}
                disabled={collectPending}
                whileTap={collectPending ? {} : { scale: 0.96 }}
              >
                <PackageOpen size={12} strokeWidth={2} />
                {collectPending ? 'Recogiendo…' : '+1 punto'}
              </motion.button>
            </div>
          ) : isBuilt && roomLevel >= TRAINING_ROOM_MAX_LEVEL ? (
            <div className="flex items-center justify-center pt-3 border-t border-border">
              <span className="text-[12px] font-bold text-text-3 uppercase tracking-[0.08em]">Nivel máximo</span>
            </div>
          ) : isBuilt ? (
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1 text-[12px] font-semibold ${resources?.wood >= upgCost.wood ? 'text-success-text' : 'text-error-text'}`}>
                  <Axe size={11} strokeWidth={2} />{fmt(upgCost.wood)}
                </span>
                <span className={`flex items-center gap-1 text-[12px] font-semibold ${resources?.iron >= upgCost.iron ? 'text-success-text' : 'text-error-text'}`}>
                  <Pickaxe size={11} strokeWidth={2} />{fmt(upgCost.iron)}
                </span>
              </div>
              <motion.button
                className="btn btn--primary btn--sm flex-shrink-0"
                onClick={() => setShowUpgradeModal(true)}
                disabled={!canAfford || mutPending || isQueueBusy || anyReady}
                whileTap={(!canAfford || mutPending || isQueueBusy || anyReady) ? {} : { scale: 0.96 }}
              >
                <ChevronRight size={12} strokeWidth={2.5} />Mejorar
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center justify-end pt-3 border-t border-border">
              <motion.button
                className="btn btn--primary btn--sm"
                onClick={onBuild}
                disabled={mutPending}
                whileTap={mutPending ? {} : { scale: 0.96 }}
              >
                <Play size={11} strokeWidth={2} />Iniciar
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación de mejora */}
      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-[300] flex items-end sm:items-center justify-center sm:p-5"
            variants={overlayVariants} initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.15 }}
            onClick={() => setShowUpgradeModal(false)}
          >
            <motion.div
              className="bg-bg border border-border-2 rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden w-full"
              style={{ maxWidth: 'min(360px, 100vw)' }}
              variants={sheetVariants} initial="initial" animate="animate" exit="exit"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb,${room.color} 15%,var(--surface-2))` }}>
                    <room.icon size={16} strokeWidth={2} style={{ color: room.color }} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-text leading-none">{room.label}</p>
                    <p className="text-[11px] text-text-3 mt-0.5">Nv.{roomLevel} → Nv.{roomLevel + 1}</p>
                  </div>
                </div>
                <button className="btn btn--ghost btn--icon" onClick={() => setShowUpgradeModal(false)}>
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              <div className="px-5 py-4 flex flex-col gap-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 border border-border">
                  <TrendingUp size={14} strokeWidth={2} className="text-text-3 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-[12px] font-semibold text-text">Cadencia tras la mejora</p>
                    <p className="text-[12px] text-text-2">
                      +1 cada ~{fmtDuration(Math.round(xpThreshold(0) / xpRateForLevel(roomLevel + 1) * 3600))}
                      <span className="text-text-3"> (antes: ~{fmtDuration(Math.round(xpThreshold(0) / xpRateForLevel(roomLevel) * 3600))})</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-text-2 flex items-center gap-1.5">
                    <Clock size={13} strokeWidth={2} className="text-text-3" />
                    Tiempo de mejora
                  </span>
                  <span className="text-[13px] font-semibold text-text">
                    {fmtDuration(trainingRoomUpgradeDurationMs(roomLevel) / 1000)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[13px] text-text-2">Coste</span>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1 text-[13px] font-semibold ${resources?.wood >= upgCost.wood ? 'text-success-text' : 'text-error-text'}`}>
                      <Axe size={12} strokeWidth={2} />{fmt(upgCost.wood)}
                    </span>
                    <span className={`flex items-center gap-1 text-[13px] font-semibold ${resources?.iron >= upgCost.iron ? 'text-success-text' : 'text-error-text'}`}>
                      <Pickaxe size={12} strokeWidth={2} />{fmt(upgCost.iron)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 flex gap-2">
                <button className="btn btn--secondary flex-1" onClick={() => setShowUpgradeModal(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn--primary flex-1"
                  disabled={!canAfford}
                  onClick={() => { setShowUpgradeModal(false); onUpgrade() }}
                >
                  <ChevronRight size={14} strokeWidth={2.5} />
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
