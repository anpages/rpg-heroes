import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Star, Shield, Swords, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { tierForRating } from '../lib/combatRating'
import { roleForClass } from '../lib/teamSynergy'

const SPEEDS = [
  { label: '×1', ms: 500 },
  { label: '×2', ms: 220 },
  { label: '×3', ms: 80  },
]

const CLASS_COLOR = {
  caudillo:  '#dc2626',
  arcanista: '#7c3aed',
  sombra:    '#0369a1',
  domador:   '#16a34a',
}

function hpColor(pct) {
  if (pct > 50) return '#22c55e'
  if (pct > 25) return '#f59e0b'
  return '#ef4444'
}

function FighterMini({ unit, hp, side }) {
  const pct = unit.max_hp > 0 ? Math.max(0, (hp / unit.max_hp) * 100) : 0
  const color = hpColor(pct)
  const dead = hp <= 0
  const classColor = CLASS_COLOR[unit.class] ?? '#6b7280'
  const role = roleForClass(unit.class)
  const isLeft = side === 'left'
  return (
    <div className={`flex flex-col gap-1 flex-1 min-w-0 ${dead ? 'opacity-40' : ''}`}>
      <div className={`flex items-center gap-1 ${isLeft ? '' : 'flex-row-reverse'}`}>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.05em] px-1 py-[1px] rounded flex-shrink-0"
          style={{
            color: classColor,
            background: `color-mix(in srgb, ${classColor} 12%, var(--surface))`,
            border: `1px solid color-mix(in srgb, ${classColor} 30%, var(--border))`,
          }}
          title={role.label}
        >
          {role.label[0]}
        </span>
        <span
          className={`text-[11px] font-bold truncate ${isLeft ? '' : 'text-right'}`}
          style={{ color: isLeft ? 'var(--blue-700)' : '#dc2626' }}
        >
          {dead ? '—' : unit.name}
        </span>
      </div>
      <div
        className="h-1.5 bg-[color-mix(in_srgb,currentColor_15%,var(--border))] rounded-full overflow-hidden w-full"
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
      <span className={`text-[10px] font-semibold tabular-nums ${isLeft ? '' : 'text-right'}`} style={{ color }}>
        {Math.max(0, hp)}/{unit.max_hp}
      </span>
    </div>
  )
}

function EventRow({ ev, lookup, index }) {
  const actor  = lookup[ev.actor]
  const target = lookup[ev.target]
  if (!actor || !target) return null
  const actorColor  = actor.side  === 'a' ? 'var(--blue-700)' : '#dc2626'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.02 }}
      className="flex items-center gap-2 px-3 py-1.5 text-[12px] border-b border-[color-mix(in_srgb,var(--border)_50%,transparent)] last:border-0"
    >
      <span className="font-bold truncate max-w-[28%]" style={{ color: actorColor }}>{actor.name}</span>
      <Swords size={10} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
      <span className="font-bold truncate max-w-[28%] text-text-2">{target.name}</span>
      <span className="ml-auto flex items-center gap-1 flex-shrink-0">
        {ev.crit && (
          <span className="text-[9px] font-extrabold text-[#f59e0b] uppercase">Crit</span>
        )}
        <span className="font-extrabold text-[#dc2626]">−{ev.damage}</span>
      </span>
    </motion.div>
  )
}

function RatingSummary({ ratings }) {
  if (!ratings?.length) return null
  return (
    <div className="flex flex-col gap-1.5 w-full max-w-[340px]">
      {ratings.map(r => {
        const tier = tierForRating(r.current)
        const positive = r.delta >= 0
        const DeltaIcon = positive ? TrendingUp : TrendingDown
        const deltaColor = positive ? '#16a34a' : '#dc2626'
        const sign = positive ? '+' : ''
        return (
          <div
            key={r.heroId}
            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border bg-[color-mix(in_srgb,var(--surface-2)_80%,transparent)]"
            style={{ borderColor: `color-mix(in srgb, ${tier.color} 25%, var(--border))` }}
          >
            <span className="text-[12px] font-bold text-text truncate">{r.heroName}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-[2px] rounded"
                style={{
                  color: tier.color,
                  background: `color-mix(in srgb, ${tier.color} 12%, var(--surface))`,
                }}
              >
                <Shield size={9} strokeWidth={2.5} />
                {tier.label}
              </span>
              <span className="flex items-center gap-[2px] text-[11px] font-bold" style={{ color: deltaColor }}>
                <DeltaIcon size={10} strokeWidth={2.5} />
                {sign}{r.delta}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResultPanel({ won, rewards, ratings, synergy, onClose }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4 px-5 py-6 flex-1 overflow-y-auto"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <motion.span
        className="text-[48px] leading-none select-none"
        initial={{ scale: 0.5, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
      >
        {won ? '🏆' : '💀'}
      </motion.span>

      <div className="text-center">
        <p className={`text-[22px] font-extrabold tracking-tight ${won ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
          {won ? '¡Victoria del escuadrón!' : 'Escuadrón derrotado'}
        </p>
        {synergy && (
          <p className="text-[12px] text-text-3 mt-1">
            <Users size={11} className="inline -mt-0.5 mr-1" strokeWidth={2} />
            {synergy.label}
            {synergy.attackPct !== 0 && (
              <span className="ml-1 font-semibold" style={{ color: synergy.attackPct > 0 ? '#16a34a' : '#dc2626' }}>
                ({synergy.attackPct > 0 ? '+' : ''}{Math.round(synergy.attackPct * 100)}% atk/def)
              </span>
            )}
          </p>
        )}
      </div>

      {won && rewards && (
        <div className="flex flex-wrap gap-2 justify-center">
          <span className="flex items-center gap-1.5 bg-[color-mix(in_srgb,#d97706_12%,var(--surface-2))] border border-[color-mix(in_srgb,#d97706_30%,var(--border))] text-text px-3 py-1.5 rounded-full text-[13px] font-bold">
            <Coins size={13} color="#d97706" strokeWidth={2} /> +{rewards.gold} oro
          </span>
          <span className="flex items-center gap-1.5 bg-[color-mix(in_srgb,#0369a1_12%,var(--surface-2))] border border-[color-mix(in_srgb,#0369a1_30%,var(--border))] text-text px-3 py-1.5 rounded-full text-[13px] font-bold">
            <Star size={13} color="#0369a1" strokeWidth={2} /> +{rewards.xpPerHero} XP c/u
          </span>
        </div>
      )}

      <RatingSummary ratings={ratings} />

      <button className="btn btn--primary btn--lg min-w-[160px] mt-1" onClick={onClose}>
        Continuar
      </button>
    </motion.div>
  )
}

/**
 * Replay visual para combates 3v3.
 *
 * Props:
 *   teamA / teamB  [{ name, class, max_hp, id? }, ...]  — 3 unidades por lado
 *   log            Array<{ round, events: [{ actor, target, damage, crit, hps }] }>
 *                  actor/target son claves 'a0'|'a1'|'a2'|'b0'|'b1'|'b2'
 *   won            boolean
 *   rewards        { gold, xpPerHero } | null
 *   ratings        Array<{ heroId, heroName, current, delta, ... }>
 *   synergy        { label, attackPct, ... }
 *   onClose        () => void
 */
export function TeamCombatReplay({ teamA, teamB, log, won, rewards, ratings, synergy, onClose }) {
  // Lookup por clave estable
  const lookup = {}
  teamA.forEach((u, i) => { lookup[`a${i}`] = { ...u, side: 'a' } })
  teamB.forEach((u, i) => { lookup[`b${i}`] = { ...u, side: 'b' } })

  const allEvents = (log ?? []).flatMap(r =>
    (r.events ?? []).map(e => ({ ...e, round: r.round }))
  )

  const [eventIndex, setEventIndex] = useState(0)
  const [phase,      setPhase]      = useState(allEvents.length > 0 ? 'playing' : 'done')
  const [speedIdx,   setSpeedIdx]   = useState(0)
  const logRef = useRef(null)

  useEffect(() => {
    if (phase !== 'playing') return
    if (eventIndex >= allEvents.length) {
      const t = setTimeout(() => setPhase('done'), 400)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setEventIndex(i => i + 1), SPEEDS[speedIdx].ms)
    return () => clearTimeout(t)
  }, [eventIndex, phase, speedIdx, allEvents.length])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [eventIndex])

  // HPs actuales derivados del último evento mostrado
  const shown = allEvents.slice(0, eventIndex)
  const lastEv = shown[shown.length - 1]
  const currentHps = lastEv?.hps ?? {
    ...Object.fromEntries(teamA.map((u, i) => [`a${i}`, u.max_hp])),
    ...Object.fromEntries(teamB.map((u, i) => [`b${i}`, u.max_hp])),
  }

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
        className="relative bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ height: 'min(92vh, 640px)' }}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {/* Header: dos columnas de 3 fighters */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-border bg-[color-mix(in_srgb,var(--blue-600)_3%,var(--surface))] flex-shrink-0">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {teamA.map((u, i) => (
              <FighterMini key={`a${i}`} unit={u} hp={currentHps[`a${i}`] ?? u.max_hp} side="left" />
            ))}
          </div>
          <span className="text-[11px] font-extrabold text-text-3 tracking-[0.12em] flex-shrink-0 self-center">VS</span>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {teamB.map((u, i) => (
              <FighterMini key={`b${i}`} unit={u} hp={currentHps[`b${i}`] ?? u.max_hp} side="right" />
            ))}
          </div>
        </div>

        {/* Contenido: log o resultado */}
        <AnimatePresence mode="wait">
          {phase !== 'done' ? (
            <div
              key="log"
              ref={logRef}
              className="flex-1 overflow-y-auto px-2 py-2 flex flex-col min-h-[180px]"
            >
              {shown.map((ev, i) => (
                <EventRow key={i} ev={ev} lookup={lookup} index={i} />
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
              ratings={ratings}
              synergy={synergy}
              onClose={onClose}
            />
          )}
        </AnimatePresence>

        {/* Footer: speed controls */}
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
