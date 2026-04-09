import { useState, useEffect, useRef } from 'react'
import { Axe, Pickaxe, Clock, Lock, ChevronRight, Hammer, PackageOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  xpRateForLevel, TRAINING_XP_CAP_HOURS,
  trainingRoomUpgradeCost, trainingRoomUpgradeDurationMs,
  TRAINING_ROOM_BUILD_COST, TRAINING_ROOM_BUILD_TIME_MS, TRAINING_ROOM_MAX_LEVEL,
} from '../../lib/gameConstants.js'
import { xpThreshold } from '../../hooks/useTraining.js'
import { STAT_LABEL_MAP } from './constants.js'
import { fmt, fmtHours, fmtTime } from './helpers.js'

export default function RoomCard({ room, roomData, progressRow, resources, baseLevel, mutPending, isQueueBusy, anyReady, collectPending, onBuild, onUpgrade, onBuildCollect, onCollect }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const collectingRef = useRef(false)

  const Icon           = room.icon
  const exists         = !!roomData
  const isBuilt        = exists && roomData.built_at !== null
  const building_ends_at = roomData?.building_ends_at ?? null
  const isConstructing = exists && !!building_ends_at
  const roomLevel      = roomData?.level ?? 0
  const lockedByBase   = !exists && baseLevel < room.baseLevelMin

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

  const rate   = xpRateForLevel(isBuilt ? roomLevel : 1)
  const xp     = isBuilt && progressRow
    ? progressRow.xp_bank + Math.min(TRAINING_XP_CAP_HOURS, (Date.now() - new Date(progressRow.last_collected_at).getTime()) / 3_600_000) * rate
    : 0
  const thr    = xpThreshold(progressRow?.total_gained ?? 0)
  const xpPct  = isBuilt && progressRow ? Math.min(100, Math.round((xp / thr) * 100)) : 0
  const gained = progressRow?.total_gained ?? 0
  const ready  = isBuilt && progressRow ? xp >= thr : false

  const upgCost   = isBuilt ? trainingRoomUpgradeCost(roomLevel) : TRAINING_ROOM_BUILD_COST
  const canAfford = resources
    ? resources.wood >= upgCost.wood && resources.iron >= upgCost.iron
    : false

  const buildDurationSec = isConstructing
    ? (isBuilt ? trainingRoomUpgradeDurationMs(roomLevel) / 1000 : TRAINING_ROOM_BUILD_TIME_MS / 1000)
    : 0
  const buildElapsed = buildDurationSec - (secondsLeft ?? buildDurationSec)
  const buildPct = buildDurationSec > 0 ? Math.min(100, Math.round((buildElapsed / buildDurationSec) * 100)) : 0

  const cardStyle = ready
    ? { borderColor: `color-mix(in srgb,${room.color} 35%,var(--border))`, background: `color-mix(in srgb,${room.color} 4%,var(--surface))` }
    : isConstructing
      ? { borderColor: `color-mix(in srgb,#0891b2 25%,var(--border))`, background: `color-mix(in srgb,#0891b2 3%,var(--surface))` }
      : {}

  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden transition-[border-color,box-shadow] duration-200 ${
        lockedByBase
          ? 'border-dashed border-border bg-surface opacity-50 pointer-events-none'
          : ready
            ? 'shadow-[var(--shadow-sm)] border-border'
            : isBuilt
              ? 'border-border bg-surface hover:border-border-2'
              : isConstructing
                ? 'border-border bg-surface'
                : 'border-dashed border-border bg-surface'
      }`}
      style={cardStyle}
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
            {isBuilt ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[11px] font-bold px-1.5 py-[3px] rounded-md leading-none"
                  style={{ color: room.color, background: `color-mix(in srgb,${room.color} 12%,var(--surface))` }}>
                  Nv.{roomLevel}
                </span>
                {isConstructing && (
                  <span className="text-[11px] font-semibold text-[#0891b2]">Mejorando…</span>
                )}
              </div>
            ) : isConstructing ? (
              <span className="text-[11px] font-semibold text-[#0891b2] flex-shrink-0">Construyendo…</span>
            ) : lockedByBase ? (
              <span className="text-[11px] text-text-3 flex-shrink-0 flex items-center gap-1">
                <Lock size={10} strokeWidth={2.5} />Base {room.baseLevelMin}
              </span>
            ) : (
              <span className="text-[11px] text-text-3 flex-shrink-0">Sin construir</span>
            )}
          </div>
          <p className="text-[11px] text-text-3 mt-0.5">
            {isBuilt ? `${rate} XP/h` : `${xpRateForLevel(1)} XP/h al construir`}
          </p>
        </div>
      </div>

      {/* Contenido central */}
      {isBuilt ? (
        <div className="px-4 pb-3 flex flex-col gap-2 border-t border-border pt-3">
          {/* Progreso de entrenamiento — siempre visible si está construida */}
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
              style={{ width: `${xpPct}%`, background: room.color }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-3">{progressRow ? `${xp.toFixed(1)} / ${thr} XP` : '—'}</span>
            {ready
              ? <span className="text-[11px] font-bold" style={{ color: room.color }}>¡Listo!</span>
              : <span className="text-[11px] text-text-3">{progressRow && thr - xp > 0 ? fmtHours((thr - xp) / rate) : ''}</span>
            }
          </div>
          {gained > 0 && (
            <p className="text-[11px] font-semibold" style={{ color: room.color }}>
              +{gained} {STAT_LABEL_MAP[room.stat]} ganados en total
            </p>
          )}
          {/* Barra de mejora — solo visible mientras se mejora */}
          {isConstructing && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#0891b2] transition-[width] duration-[1000ms] linear"
                  style={{ width: `${buildPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-3">Mejora en curso</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#0891b2]">
                  <Clock size={9} strokeWidth={2} />
                  {secondsLeft !== null ? fmtTime(secondsLeft) : '…'}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : isConstructing ? (
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
      ) : (
        <div className="px-4 pb-3 border-t border-border pt-3">
          <p className="text-[12px] text-text-3 leading-relaxed">
            {lockedByBase
              ? `Requiere base nivel ${room.baseLevelMin} para construir.`
              : `Construye esta sala para entrenar ${room.label.toLowerCase()} de forma pasiva.`
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
                Recoger
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
                onClick={() => isBuilt ? onUpgrade() : onBuild()}
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
    </div>
  )
}
