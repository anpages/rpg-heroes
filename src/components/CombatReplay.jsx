import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Star, Zap } from 'lucide-react'

const SPEEDS = [
  { label: '×1', ms: 500 },
  { label: '×2', ms: 220 },
  { label: '×3', ms: 80  },
]

function hpColor(pct) {
  if (pct > 50) return '#22c55e'
  if (pct > 25) return '#f59e0b'
  return '#ef4444'
}

function FighterBar({ name, hp, maxHp, side }) {
  const pct  = maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 0
  const color = hpColor(pct)
  const isLeft = side === 'left'

  return (
    <div className={`flex flex-col gap-1 flex-1 min-w-0 ${isLeft ? '' : 'items-end'}`}>
      <span
        className="text-[13px] font-bold truncate max-w-full"
        style={{ color: isLeft ? 'var(--blue-700)' : '#dc2626' }}
      >
        {name}
      </span>
      {/* HP bar — enemy fills from right */}
      <div
        className="h-2 bg-[color-mix(in_srgb,currentColor_15%,var(--border))] rounded-full overflow-hidden w-full"
        style={{ direction: isLeft ? 'ltr' : 'rtl' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: 'width 300ms ease-out, background 300ms',
          }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
        {hp}/{maxHp}
      </span>
    </div>
  )
}

function EventRow({ ev, heroName, enemyName, index }) {
  const isHero = ev.actor === 'a'
  const name   = isHero ? heroName : enemyName

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      className={`flex items-center gap-2 px-3 py-[7px] rounded-lg text-[13px] ${
        ev.crit
          ? 'bg-[color-mix(in_srgb,#d97706_14%,var(--bg))] border border-[color-mix(in_srgb,#d97706_35%,var(--border))]'
          : index % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-transparent'
      }`}
    >
      {/* Round badge */}
      <span className="text-[10px] font-bold text-text-3 w-[22px] flex-shrink-0 tabular-nums">
        R{ev.round}
      </span>

      {/* Icon */}
      <span className="text-[15px] flex-shrink-0 leading-none select-none">
        {ev.crit ? '✦' : isHero ? '⚔' : '🗡'}
      </span>

      {/* Name */}
      <span
        className="font-semibold flex-1 truncate"
        style={{ color: isHero ? 'var(--blue-700)' : '#dc2626' }}
      >
        {name}
      </span>

      {/* Crit badge */}
      {ev.crit && (
        <span className="text-[10px] font-extrabold text-[#d97706] uppercase tracking-wide flex-shrink-0">
          ¡CRÍTICO!
        </span>
      )}

      {/* Damage */}
      <span
        className="font-bold text-[14px] flex-shrink-0 tabular-nums"
        style={{ color: isHero ? 'var(--blue-700)' : '#dc2626' }}
      >
        −{ev.damage}
      </span>

      {/* Remaining HP of target */}
      <span className="text-[11px] text-text-3 flex-shrink-0 tabular-nums hidden sm:inline">
        {isHero ? ev.hpB : ev.hpA} HP
      </span>
    </motion.div>
  )
}

function ResultPanel({ won, rewards, knockedOut, onClose }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-5 px-6 py-8 flex-1"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <motion.span
        className="text-[56px] leading-none select-none"
        initial={{ scale: 0.5, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
      >
        {won ? '🏆' : '💀'}
      </motion.span>

      <div className="text-center">
        <p className={`text-[26px] font-extrabold tracking-tight ${won ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
          {won ? '¡Victoria!' : 'Derrota'}
        </p>
        {knockedOut && !won && (
          <p className="text-[13px] text-text-3 mt-1">Héroe derribado. Recuperándose.</p>
        )}
        {!won && !knockedOut && (
          <p className="text-[13px] text-text-3 mt-1">El enemigo aguantó este asalto.</p>
        )}
      </div>

      {won && rewards && (
        <div className="flex flex-wrap gap-2 justify-center">
          <span className="flex items-center gap-1.5 bg-[color-mix(in_srgb,#d97706_12%,var(--surface-2))] border border-[color-mix(in_srgb,#d97706_30%,var(--border))] text-text px-3 py-1.5 rounded-full text-[13px] font-bold">
            <Coins size={13} color="#d97706" strokeWidth={2} /> +{rewards.gold} oro
          </span>
          <span className="flex items-center gap-1.5 bg-[color-mix(in_srgb,#0369a1_12%,var(--surface-2))] border border-[color-mix(in_srgb,#0369a1_30%,var(--border))] text-text px-3 py-1.5 rounded-full text-[13px] font-bold">
            <Star size={13} color="#0369a1" strokeWidth={2} /> +{rewards.experience} XP
          </span>
          {rewards.milestone && (
            <span className="flex items-center gap-1.5 bg-[color-mix(in_srgb,#d97706_15%,var(--surface-2))] border border-[color-mix(in_srgb,#d97706_40%,var(--border))] text-[#b45309] px-3 py-1.5 rounded-full text-[13px] font-bold">
              ★ Hito · ×2
            </span>
          )}
          {rewards.levelUp && (
            <span className="flex items-center gap-1.5 bg-[color-mix(in_srgb,#7c3aed_12%,var(--surface-2))] border border-[color-mix(in_srgb,#7c3aed_30%,var(--border))] text-[#7c3aed] px-3 py-1.5 rounded-full text-[13px] font-bold">
              <Zap size={13} strokeWidth={2} /> ¡Nivel!
            </span>
          )}
          {rewards.drop?.item_catalog && (
            <span className="flex items-center gap-1.5 bg-[color-mix(in_srgb,#7c3aed_10%,var(--surface-2))] border border-[color-mix(in_srgb,#7c3aed_25%,var(--border))] text-[#7c3aed] px-3 py-1.5 rounded-full text-[13px] font-bold">
              ⚔ {rewards.drop.item_catalog.name}
            </span>
          )}
        </div>
      )}

      <button className="btn btn--primary btn--lg min-w-[160px] mt-2" onClick={onClose}>
        Continuar
      </button>
    </motion.div>
  )
}

/**
 * Modal de replay de combate.
 *
 * Props:
 *   heroName    {string}
 *   enemyName   {string}
 *   heroMaxHp   {number}  — max_hp efectivo usado en el combate
 *   enemyMaxHp  {number}
 *   log         {Round[]} — resultado de simulateCombat
 *   won         {boolean}
 *   rewards     {object|null}
 *   knockedOut  {boolean}
 *   onClose     {() => void}
 */
export function CombatReplay({ heroName, enemyName, heroMaxHp, enemyMaxHp, log, won, rewards, knockedOut, onClose }) {
  // Aplanar todas las rondas en un array secuencial de eventos
  const allEvents = (log ?? []).flatMap(r =>
    (r.events ?? []).map(e => ({ ...e, round: r.round }))
  )

  const [eventIndex, setEventIndex] = useState(0)
  const [phase,      setPhase]      = useState(allEvents.length > 0 ? 'playing' : 'done')
  const [speedIdx,   setSpeedIdx]   = useState(0)
  const logRef = useRef(null)

  // Avanzar un evento cada `speed` ms
  useEffect(() => {
    if (phase !== 'playing') return
    if (eventIndex >= allEvents.length) {
      const t = setTimeout(() => setPhase('done'), 400)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setEventIndex(i => i + 1), SPEEDS[speedIdx].ms)
    return () => clearTimeout(t)
  }, [eventIndex, phase, speedIdx, allEvents.length])

  // Auto-scroll al último evento
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [eventIndex])

  // HP actuales derivados del último evento mostrado
  const shown = allEvents.slice(0, eventIndex)
  const last  = shown[shown.length - 1]
  const hpA   = last ? last.hpA : heroMaxHp
  const hpB   = last ? last.hpB : enemyMaxHp

  function skip() {
    setEventIndex(allEvents.length)
    setPhase('done')
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      <motion.div
        className="relative bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-lg flex flex-col overflow-hidden"
        style={{ height: 'min(92vh, 560px)' }}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {/* ── Header: barras de HP ── */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border bg-[color-mix(in_srgb,var(--blue-600)_3%,var(--surface))] flex-shrink-0">
          <FighterBar name={heroName}  hp={hpA} maxHp={heroMaxHp}  side="left"  />
          <span className="text-[11px] font-extrabold text-text-3 tracking-[0.12em] flex-shrink-0">VS</span>
          <FighterBar name={enemyName} hp={hpB} maxHp={enemyMaxHp} side="right" />
        </div>

        {/* ── Contenido: log o resultado ── */}
        <AnimatePresence mode="wait">
          {phase !== 'done' ? (
            <div
              key="log"
              ref={logRef}
              className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1 min-h-[220px]"
            >
              {shown.map((ev, i) => (
                <EventRow key={i} ev={ev} heroName={heroName} enemyName={enemyName} index={i} />
              ))}
              <div className="px-3 py-1 text-[12px] text-text-3">
                <span className="animate-pulse">···</span>
              </div>
            </div>
          ) : (
            <ResultPanel
              key="result"
              won={won}
              rewards={rewards}
              knockedOut={knockedOut}
              onClose={onClose}
            />
          )}
        </AnimatePresence>

        {/* ── Footer: controles de velocidad (solo mientras se reproduce) ── */}
        {phase === 'playing' && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border flex-shrink-0">
            <div className="flex gap-1.5">
              {SPEEDS.map((s, i) => (
                <button
                  key={s.label}
                  className={`btn btn--sm ${speedIdx === i ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => setSpeedIdx(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button className="btn btn--ghost btn--sm text-text-3" onClick={skip}>
              Saltar →
            </button>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  )
}
