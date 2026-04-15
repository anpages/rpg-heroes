import { useState, useEffect, useRef, useReducer } from 'react'
import { Axe, Pickaxe, Clock, Lock, ChevronRight, Hammer, PackageOpen, X, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  xpRateForLevel,
  trainingRoomUpgradeCost, trainingRoomUpgradeDurationMs,
  TRAINING_ROOM_BUILD_COST_BY_STAT, TRAINING_ROOM_BUILD_TIME_MS, TRAINING_ROOM_MAX_LEVEL,
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

export default function RoomCard({ room, roomData, progressRow, resources, baseLevel, mutPending, isQueueBusy, anyReady, collectPending, onBuild, onUpgrade, onBuildCollect, onCollect }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const collectingRef = useRef(false)
  const [, tick] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  const Icon             = room.icon
  const exists           = !!roomData
  const isBuilt          = exists && roomData.built_at !== null
  const building_ends_at = roomData?.building_ends_at ?? null
  const isConstructing   = exists && !!building_ends_at
  const roomLevel        = roomData?.level ?? 0
  const lockedByBase     = !exists && baseLevel < room.baseLevelMin

  useEffect(() => {
    if (!isConstructing) { setSecondsLeft(null); collectingRef.current = false; return }
    const endTime = new Date(building_ends_at)
    function tick() {
      const rem = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setSecondsLeft(rem)
      if (rem === 0 && !collectingRef.current) {
        collectingRef.current = true
        onBuildCollect()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building_ends_at])

  const rate    = xpRateForLevel(isBuilt ? roomLevel : 1)
  const thr     = xpThreshold(progressRow?.total_gained ?? 0)
  const upgrading = isBuilt && isConstructing

  // XP actual interpolada en tiempo real
  const xp = isBuilt && progressRow && !upgrading
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

  const xpPct  = isBuilt && progressRow ? Math.min(100, Math.round((xp / thr) * 100)) : 0
  const ready  = isBuilt && progressRow && !upgrading ? xp >= thr : false

  // Segundos restantes para el próximo punto
  const secsToNext = isBuilt && progressRow && !ready && !upgrading
    ? Math.max(0, Math.round((thr - xp) / rate * 3600))
    : 0

  // Horas por punto (para mostrar cadencia)
  const hoursPerPoint = thr / rate

  const upgCost   = isBuilt ? trainingRoomUpgradeCost(roomLevel) : (TRAINING_ROOM_BUILD_COST_BY_STAT[room.stat] ?? TRAINING_ROOM_BUILD_COST_BY_STAT.strength)
  const canAfford = resources
    ? resources.wood >= upgCost.wood && resources.iron >= upgCost.iron
    : false

  const buildDurationSec = isConstructing
    ? (isBuilt ? trainingRoomUpgradeDurationMs(roomLevel) / 1000 : TRAINING_ROOM_BUILD_TIME_MS / 1000)
    : 0
  const buildElapsed = buildDurationSec - (secondsLeft ?? buildDurationSec)
  const buildPct = buildDurationSec > 0 ? Math.min(100, Math.round((buildElapsed / buildDurationSec) * 100)) : 0

  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden transition-[border-color] duration-200 ${
        lockedByBase
          ? 'border-dashed border-border bg-surface opacity-50 pointer-events-none'
          : ready
            ? 'border-border bg-surface shadow-[var(--shadow-sm)]'
            : isBuilt
              ? 'border-border bg-surface'
              : isConstructing
                ? 'border-border bg-surface'
                : 'border-dashed border-border bg-surface'
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
            <p className={`text-[14px] font-bold leading-none ${isBuilt || isConstructing ? 'text-text' : 'text-text-3'}`}>
              {room.label}
            </p>
            {isBuilt && !isConstructing && (
              <span className="text-[11px] font-bold px-1.5 py-[3px] rounded-md leading-none flex-shrink-0"
                style={{ color: room.color, background: `color-mix(in srgb,${room.color} 12%,var(--surface))` }}>
                Nv.{roomLevel}
              </span>
            )}
            {isConstructing && (
              <span className="text-[11px] font-semibold text-[#0891b2] flex-shrink-0">
                {isBuilt ? 'Mejorando…' : 'Construyendo…'}
              </span>
            )}
            {!isBuilt && !isConstructing && lockedByBase && (
              <span className="text-[11px] text-text-3 flex-shrink-0 flex items-center gap-1">
                <Lock size={10} strokeWidth={2.5} />Base {room.baseLevelMin}
              </span>
            )}
            {!isBuilt && !isConstructing && !lockedByBase && (
              <span className="text-[11px] text-text-3 flex-shrink-0">Sin construir</span>
            )}
          </div>

          {/* Cadencia */}
          <p className="text-[11px] text-text-3 mt-0.5">
            {isBuilt && !upgrading
              ? `+1 cada ~${fmtDuration(Math.round(hoursPerPoint * 3600))}`
              : isBuilt && upgrading
                ? 'Pausado durante la mejora'
                : `+1 cada ~${fmtDuration(Math.round(xpThreshold(0) / xpRateForLevel(1) * 3600))} al construir`
            }
          </p>
        </div>
      </div>

      {/* Progreso */}
      {isBuilt && !upgrading && (
        <div className="px-4 pb-3 border-t border-border pt-3 flex flex-col gap-2">
          {/* Barra */}
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

      {/* Pausado durante mejora */}
      {isBuilt && upgrading && (
        <div className="px-4 pb-3 border-t border-border pt-3 flex flex-col gap-2">
          <div className="h-2 rounded-full overflow-hidden bg-border">
            <div className="h-full rounded-full bg-[#0891b2] transition-[width] duration-[1000ms] linear"
              style={{ width: `${buildPct}%` }} />
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

      {/* Construcción */}
      {!isBuilt && isConstructing && (
        <div className="px-4 pb-3 border-t border-border pt-3 flex flex-col gap-2">
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#0891b2] transition-[width] duration-[1000ms] linear"
              style={{ width: `${buildPct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-3">Construcción en curso</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#0891b2]">
              <Clock size={10} strokeWidth={2} />
              {secondsLeft !== null ? fmtTime(secondsLeft) : '…'}
            </span>
          </div>
        </div>
      )}

      {/* Sin construir */}
      {!isBuilt && !isConstructing && (
        <div className="px-4 pb-3 border-t border-border pt-3">
          <p className="text-[12px] text-text-3 leading-relaxed">
            {lockedByBase
              ? `Requiere base nivel ${room.baseLevelMin} para construir.`
              : `Genera +1 a ${room.label.toLowerCase()} de forma pasiva.`
            }
          </p>
        </div>
      )}

      {/* Acción */}
      {!isConstructing && !lockedByBase && (
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
                {collectPending ? 'Recogiendo…' : 'Recoger +1'}
              </motion.button>
            </div>
          ) : isBuilt && roomLevel >= TRAINING_ROOM_MAX_LEVEL ? (
            <div className="flex items-center justify-center pt-3 border-t border-border">
              <span className="text-[12px] font-bold text-text-3 uppercase tracking-[0.08em]">Nivel máximo</span>
            </div>
          ) : (
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
                onClick={() => isBuilt ? setShowUpgradeModal(true) : onBuild()}
                disabled={!canAfford || mutPending || isQueueBusy || anyReady}
                whileTap={(!canAfford || mutPending || isQueueBusy || anyReady) ? {} : { scale: 0.96 }}
              >
                {isBuilt ? (
                  <><ChevronRight size={12} strokeWidth={2.5} />Mejorar</>
                ) : (
                  <><Hammer size={12} strokeWidth={2.5} />Construir</>
                )}
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
              {/* Header */}
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

              {/* Info */}
              <div className="px-5 py-4 flex flex-col gap-3">
                {/* Mejora de cadencia */}
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

                {/* Tiempo */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-text-2 flex items-center gap-1.5">
                    <Clock size={13} strokeWidth={2} className="text-text-3" />
                    Tiempo de mejora
                  </span>
                  <span className="text-[13px] font-semibold text-text">
                    {fmtDuration(trainingRoomUpgradeDurationMs(roomLevel) / 1000)}
                  </span>
                </div>

                {/* Coste */}
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

              {/* Acciones */}
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
