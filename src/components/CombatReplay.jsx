import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Star, Zap, Loader, Sparkles, Package, Scroll } from 'lucide-react'
import { COMBAT_DECISIONS } from '../lib/combatDecisions'
import { CLASS_ABILITIES, getStance } from '../lib/combatAbilities'
import { CLASS_COLORS } from '../lib/gameConstants'

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

function stanceColor(key) {
  if (key === 'aggressive') return '#f59e0b'
  if (key === 'desperate')  return '#ef4444'
  return 'var(--text-3)'
}

function classColor(cls) {
  return CLASS_COLORS[cls] ?? 'var(--text-2)'
}

const CLASS_LABEL = {
  caudillo:  'Caudillo',
  sombra:    'Sombra',
  arcanista: 'Arcanista',
  domador:   'Domador',
  universal: 'Universal',
}

function FighterBar({ name, hp, maxHp, side, stance, cls }) {
  const pct   = maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 0
  const color = hpColor(pct)
  const isLeft = side === 'left'
  const abilities = cls ? CLASS_ABILITIES[cls] : null

  return (
    <div className={`flex flex-col gap-1 flex-1 min-w-0 ${isLeft ? '' : 'items-end'}`}>
      <div className={`flex items-center gap-1.5 ${isLeft ? '' : 'flex-row-reverse'}`}>
        <span
          className="text-[13px] font-bold truncate"
          style={{ color: cls ? classColor(cls) : (isLeft ? 'var(--blue-700)' : '#dc2626') }}
        >
          {name}
        </span>
        {cls && CLASS_LABEL[cls] && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-full border flex-shrink-0"
            style={{
              color: classColor(cls),
              borderColor: `color-mix(in srgb, ${classColor(cls)} 35%, var(--border))`,
              background:  `color-mix(in srgb, ${classColor(cls)} 10%, var(--surface))`,
            }}
          >
            {CLASS_LABEL[cls]}
          </span>
        )}
        {abilities?.passive && (
          <span className="text-[10px] opacity-70 flex-shrink-0" title={abilities.passive.label}>
            {abilities.passive.icon}
          </span>
        )}
      </div>
      {/* HP bar */}
      <div
        className="h-2.5 bg-[color-mix(in_srgb,currentColor_15%,var(--border))] rounded-full overflow-hidden w-full"
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
      <div className={`flex items-center gap-2 ${isLeft ? '' : 'flex-row-reverse'}`}>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
          {hp}/{maxHp}
        </span>
        {stance && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-full border"
            style={{
              color: stanceColor(stance.key),
              borderColor: `color-mix(in srgb, ${stanceColor(stance.key)} 35%, var(--border))`,
              background:  `color-mix(in srgb, ${stanceColor(stance.key)} 8%, var(--surface))`,
            }}
          >
            {stance.label}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Floating damage number ─────────────────────────────────────────────── */

function FloatingDamage({ damage, crit, side }) {
  const isLeft = side === 'left'
  return (
    <motion.span
      className={`absolute text-[20px] font-black pointer-events-none select-none z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] ${crit ? 'text-[#d97706]' : isLeft ? 'text-[var(--blue-700)]' : 'text-[#dc2626]'}`}
      style={{ [isLeft ? 'left' : 'right']: '12px', top: '18px' }}
      initial={{ opacity: 1, y: 0, scale: crit ? 1.5 : 1.15 }}
      animate={{ opacity: 0, y: -22, scale: 1 }}
      transition={{ duration: 0.75 }}
    >
      {crit && '✦ '}-{damage}
    </motion.span>
  )
}

/* ── Event rendering ────────────────────────────────────────────────────── */

function EventRow({ ev, heroName, enemyName, index }) {
  const type   = ev.type ?? 'attack'
  const isHero = ev.actor === 'a'
  const name   = isHero ? heroName : enemyName

  // Dodge event
  if (type === 'dodge') {
    const dodgerName    = ev.dodger === 'a' ? heroName : enemyName
    const dodgerIsHero  = ev.dodger === 'a'
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="flex items-center gap-2 px-3 py-[7px] rounded-lg text-[13px] bg-[color-mix(in_srgb,#7c3aed_10%,var(--bg))] border border-[color-mix(in_srgb,#7c3aed_25%,var(--border))]"
        style={{ borderLeft: `3px solid ${dodgerIsHero ? 'var(--blue-700)' : '#dc2626'}` }}
      >
        <span className="text-[10px] font-bold text-text-3 w-[22px] flex-shrink-0 tabular-nums">R{ev.round}</span>
        <span className="text-[15px] flex-shrink-0 leading-none select-none">💨</span>
        <span className="font-semibold text-[#7c3aed] flex-1 truncate">{dodgerName}</span>
        <span className="text-[11px] font-bold text-[#7c3aed] uppercase tracking-wide">¡Esquiva!</span>
      </motion.div>
    )
  }

  // Ability event
  if (type === 'ability') {
    const hasAtkDmg = ev.damage != null && ev.damage > 0
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="flex items-center gap-2 px-3 py-[7px] rounded-lg text-[13px] bg-[color-mix(in_srgb,#d97706_10%,var(--bg))] border border-[color-mix(in_srgb,#d97706_30%,var(--border))]"
        style={{ borderLeft: `3px solid ${isHero ? 'var(--blue-700)' : '#dc2626'}` }}
      >
        <span className="text-[10px] font-bold text-text-3 w-[22px] flex-shrink-0 tabular-nums">R{ev.round}</span>
        <span className="text-[15px] flex-shrink-0 leading-none select-none">{ev.icon ?? '⚡'}</span>
        <span className="font-semibold flex-1 truncate" style={{ color: isHero ? 'var(--blue-700)' : '#dc2626' }}>
          {name}
        </span>
        <span className="text-[9px] font-bold px-1 py-[1px] rounded border flex-shrink-0 uppercase tracking-wide"
          style={{ color: '#d97706', borderColor: 'color-mix(in srgb, #d97706 40%, var(--border))', background: 'color-mix(in srgb, #d97706 12%, var(--bg))' }}>
          clase
        </span>
        <span className="text-[11px] font-extrabold text-[#d97706] uppercase tracking-wide flex-shrink-0">
          {ev.label}
        </span>
        {hasAtkDmg && (
          <span className="font-bold text-[14px] flex-shrink-0 tabular-nums" style={{ color: isHero ? 'var(--blue-700)' : '#dc2626' }}>
            −{ev.damage}
          </span>
        )}
      </motion.div>
    )
  }

  // Passive proc event
  if (type === 'passive') {
    const hasDmg = ev.damage != null && ev.damage > 0
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="flex items-center gap-2 px-3 py-[7px] rounded-lg text-[13px] bg-[color-mix(in_srgb,#a855f7_8%,var(--bg))] border border-[color-mix(in_srgb,#a855f7_25%,var(--border))]"
        style={{ borderLeft: `3px solid ${isHero ? 'var(--blue-700)' : '#dc2626'}` }}
      >
        <span className="text-[10px] font-bold text-text-3 w-[22px] flex-shrink-0 tabular-nums">R{ev.round}</span>
        <span className="text-[15px] flex-shrink-0 leading-none select-none">{ev.icon ?? '✨'}</span>
        <span className="font-semibold flex-1 truncate" style={{ color: isHero ? 'var(--blue-700)' : '#dc2626' }}>
          {name}
        </span>
        <span className="text-[9px] font-bold px-1 py-[1px] rounded border flex-shrink-0 uppercase tracking-wide"
          style={{ color: '#a855f7', borderColor: 'color-mix(in srgb, #a855f7 40%, var(--border))', background: 'color-mix(in srgb, #a855f7 12%, var(--bg))' }}>
          clase
        </span>
        <span className="text-[10px] font-bold text-[#a855f7] uppercase tracking-wide flex-shrink-0">
          {ev.label}
        </span>
        {hasDmg && (
          <span className="font-bold text-[14px] flex-shrink-0 tabular-nums text-[#a855f7]">
            −{ev.damage}
          </span>
        )}
      </motion.div>
    )
  }

  // Tactic activation event
  if (type === 'tactic') {
    const hasDmg = ev.damage != null && ev.damage > 0
    const hasHeal = ev.heal != null && ev.heal > 0
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="flex items-center gap-2 px-3 py-[7px] rounded-lg text-[13px] bg-[color-mix(in_srgb,#7c3aed_10%,var(--bg))] border border-[color-mix(in_srgb,#7c3aed_30%,var(--border))]"
        style={{ borderLeft: `3px solid ${isHero ? 'var(--blue-700)' : '#dc2626'}` }}
      >
        <span className="text-[10px] font-bold text-text-3 w-[22px] flex-shrink-0 tabular-nums">R{ev.round}</span>
        <span className="text-[15px] flex-shrink-0 leading-none select-none">{ev.icon ?? '⚔'}</span>
        <span className="font-semibold flex-1 truncate" style={{ color: isHero ? 'var(--blue-700)' : '#dc2626' }}>
          {name}
        </span>
        <span className="text-[9px] font-bold px-1 py-[1px] rounded border flex-shrink-0 uppercase tracking-wide"
          style={{ color: '#7c3aed', borderColor: 'color-mix(in srgb, #7c3aed 40%, var(--border))', background: 'color-mix(in srgb, #7c3aed 12%, var(--bg))' }}>
          táct.
        </span>
        <span className="text-[10px] font-extrabold text-[#7c3aed] uppercase tracking-wide flex-shrink-0">
          {ev.label}
        </span>
        {hasDmg && (
          <span className="font-bold text-[14px] flex-shrink-0 tabular-nums text-[#7c3aed]">
            −{ev.damage}
          </span>
        )}
        {hasHeal && (
          <span className="font-bold text-[14px] flex-shrink-0 tabular-nums text-[#16a34a]">
            +{ev.heal}
          </span>
        )}
      </motion.div>
    )
  }

  // Stance change event
  if (type === 'stance') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="flex items-center gap-2 px-3 py-[5px] rounded-lg text-[12px] text-text-3"
        style={{ borderLeft: `3px solid ${isHero ? 'var(--blue-700)' : '#dc2626'}` }}
      >
        <span className="text-[10px] font-bold w-[22px] flex-shrink-0 tabular-nums">R{ev.round}</span>
        <span className="text-[13px] flex-shrink-0 leading-none select-none">
          {ev.stance === 'aggressive' ? '🔥' : ev.stance === 'desperate' ? '💢' : '⚖️'}
        </span>
        <span className="font-medium flex-1 truncate italic">
          {name} cambia a postura <span className="font-bold not-italic" style={{ color: stanceColor(ev.stance) }}>{ev.label}</span>
        </span>
      </motion.div>
    )
  }

  // Regular attack (default / backward compat)
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      className={`relative flex items-center gap-2 px-3 py-[7px] rounded-lg text-[13px] ${
        ev.crit
          ? 'bg-[color-mix(in_srgb,#d97706_14%,var(--bg))] border border-[color-mix(in_srgb,#d97706_35%,var(--border))]'
          : index % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-transparent'
      }`}
      style={{ borderLeft: `3px solid ${isHero ? 'var(--blue-700)' : '#dc2626'}` }}
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
          ¡CRIT!
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

function KeyMomentPanel({ decisions, onDecide, loading }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4 px-5 py-6 flex-1"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center">
        <motion.span
          className="text-[40px] leading-none select-none block mb-1"
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          ⚡
        </motion.span>
        <p className="text-[20px] font-extrabold text-text tracking-tight">¡Momento clave!</p>
        <p className="text-[12px] text-text-3 mt-1">El destino del combate está en tus manos</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-full max-w-[400px]">
        {(decisions ?? []).map(key => {
          const dec = COMBAT_DECISIONS[key]
          if (!dec) return null
          return (
            <motion.button
              key={key}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-[transform,background] disabled:opacity-50"
              style={{
                borderColor: dec.color,
                background: `color-mix(in srgb, ${dec.color} 8%, var(--surface))`,
              }}
              onClick={() => !loading && onDecide?.(key)}
              disabled={loading}
              whileHover={loading ? {} : { scale: 1.03 }}
              whileTap={loading ? {} : { scale: 0.97 }}
            >
              <span className="text-[24px] leading-none">{dec.icon}</span>
              <span className="text-[13px] font-extrabold leading-tight" style={{ color: dec.color }}>
                {dec.label}
              </span>
              <span className="text-[10px] text-text-2 font-medium leading-tight">
                {dec.description}
              </span>
            </motion.button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[12px] text-text-3">
          <Loader size={12} className="animate-spin" />
          Resolviendo combate...
        </div>
      )}
    </motion.div>
  )
}

function ResultPanel({ won, rewards, onClose }) {
  const hasFragments = rewards?.fragments > 0
  const hasDrop      = !!rewards?.drop?.item_catalog
  const dropName     = hasDrop ? (rewards.drop.item_catalog?.name ?? 'Ítem') : null
  const hasTactic    = !!rewards?.tactic?.tactic
  const tacticName   = hasTactic ? (rewards.tactic.tactic.name ?? 'Táctica') : null
  const tacticIsNew  = hasTactic && rewards.tactic.isNew
  const tacticLevel  = hasTactic ? rewards.tactic.newLevel : null

  return (
    <div className="flex items-start gap-3">
      <span className="text-[24px] leading-none select-none flex-shrink-0 mt-0.5">{won ? '🏆' : '💀'}</span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className={`text-[15px] font-extrabold tracking-tight ${won ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
          {won ? '¡Victoria!' : 'Derrota'}
        </p>
        {rewards && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2 tabular-nums">
              <Coins size={11} color="#d97706" strokeWidth={2} />+{rewards.gold} oro
            </span>
            <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2 tabular-nums">
              <Star size={11} color="#0369a1" strokeWidth={2} />+{rewards.experience} XP
              {rewards.milestone && <span className="text-[#d97706]"> ×2</span>}
              {rewards.levelUp   && <span className="text-[#16a34a]"> · ¡Nivel!</span>}
            </span>
            {hasFragments && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-[#f59e0b] tabular-nums">
                <Sparkles size={11} strokeWidth={2} />+{rewards.fragments} frags
              </span>
            )}
            {hasDrop && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-[#a855f7] tabular-nums">
                <Package size={11} strokeWidth={2} />{dropName}
              </span>
            )}
            {hasTactic && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-[#06b6d4] tabular-nums">
                <Scroll size={11} strokeWidth={2} />
                {tacticName}
                {tacticIsNew ? ' (nueva)' : ` → Nv.${tacticLevel}`}
              </span>
            )}
          </div>
        )}
      </div>
      <button className="btn btn--primary btn--sm flex-shrink-0" onClick={onClose}>
        Continuar
      </button>
    </div>
  )
}

/**
 * Modal de replay de combate.
 *
 * Props:
 *   heroName       {string}
 *   enemyName      {string}
 *   heroMaxHp      {number}  — max_hp efectivo usado en el combate
 *   enemyMaxHp     {number}
 *   log            {Round[]} — resultado de simulateCombat (puede crecer si hay Momento clave)
 *   won            {boolean}
 *   rewards        {object|null}
 *   onClose        {() => void}
 *   heroClass      {string|null}  — clase del héroe
 *   archetype      {string|null}  — arquetipo del enemigo
 *   keyMomentPause {boolean}
 *   decisions      {string[]}
 *   onDecide       {(key) => void}
 *   resolving      {boolean}
 */
export function CombatReplay({
  heroName, enemyName, heroMaxHp, enemyMaxHp, log,
  won, rewards, onClose,
  heroClass, archetype,
  keyMomentPause, decisions, onDecide, resolving,
  enemyTactics,
}) {
  const resolvedHeroClass  = heroClass ?? null
  const resolvedEnemyClass = archetype ?? null

  // Aplanar todas las rondas en un array secuencial de eventos
  const allEvents = (log ?? []).flatMap(r =>
    (r.events ?? []).map(e => ({ ...e, round: r.round }))
  )

  const [eventIndex, setEventIndex] = useState(0)
  const [phase,      setPhase]      = useState(allEvents.length > 0 ? 'playing' : 'done')
  const [speedIdx,   setSpeedIdx]   = useState(0)
  const logRef  = useRef(null)
  const [floats, setFloats] = useState([])
  const floatId = useRef(0)

  // Si el log crece (post Momento clave), reanudar la reproducción
  useEffect(() => {
    if (phase === 'done' && eventIndex < allEvents.length && !keyMomentPause) {
      setPhase('playing')
    }
  }, [allEvents.length, keyMomentPause])  // eslint-disable-line react-hooks/exhaustive-deps

  // Avanzar un evento cada `speed` ms
  useEffect(() => {
    if (phase !== 'playing') return
    if (eventIndex >= allEvents.length) {
      const t = setTimeout(() => setPhase('done'), 400)
      return () => clearTimeout(t)
    }
    // Dramatic pause on the killing blow
    const ev = allEvents[eventIndex]
    const isKill = ev && ((ev.hpA != null && ev.hpA <= 0) || (ev.hpB != null && ev.hpB <= 0))
    const delay = isKill ? Math.max(SPEEDS[speedIdx].ms, 600) : SPEEDS[speedIdx].ms
    const t = setTimeout(() => {
      // Spawn floating damage
      if (ev && ev.damage > 0) {
        const id = floatId.current++
        const side = ev.actor === 'a' ? 'right' : 'left'
        setFloats(f => [...f, { id, damage: ev.damage, crit: ev.crit, side }])
        setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 800)
      }
      setEventIndex(i => i + 1)
    }, delay)
    return () => clearTimeout(t)
  }, [eventIndex, phase, speedIdx, allEvents])

  // Auto-scroll al último evento
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [eventIndex])

  // HP actuales derivados del último evento mostrado
  const shown = allEvents.slice(0, eventIndex)
  const last  = shown[shown.length - 1]
  const hpA   = last?.hpA ?? heroMaxHp
  const hpB   = last?.hpB ?? enemyMaxHp

  // Stances derivados del HP actual
  const stanceA = resolvedHeroClass  ? getStance(hpA, heroMaxHp)  : null
  const stanceB = resolvedEnemyClass ? getStance(hpB, enemyMaxHp) : null

  // Shake on crit
  const lastShown = shown[shown.length - 1]
  const isShaking = lastShown?.crit && eventIndex > 0

  function skip() {
    setEventIndex(allEvents.length)
    setPhase('done')
    setFloats([])
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      <motion.div
        className="relative bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-lg flex flex-col overflow-hidden"
        style={{ height: 'min(92vh, 600px)' }}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{
          opacity: 1, scale: 1, y: 0,
          x: isShaking ? [0, -3, 3, -2, 2, 0] : 0,
        }}
        transition={isShaking
          ? { x: { duration: 0.3 }, default: { duration: 0.22, ease: 'easeOut' } }
          : { duration: 0.22, ease: 'easeOut' }
        }
      >
        {/* ── Header: barras de HP ── */}
        <div className="relative flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border bg-[color-mix(in_srgb,var(--blue-600)_3%,var(--surface))] flex-shrink-0">
          <FighterBar name={heroName}  hp={hpA} maxHp={heroMaxHp}  side="left"  stance={stanceA} cls={resolvedHeroClass}  />
          <span className="text-[11px] font-extrabold text-text-3 tracking-[0.12em] flex-shrink-0">VS</span>
          <FighterBar name={enemyName} hp={hpB} maxHp={enemyMaxHp} side="right" stance={stanceB} cls={resolvedEnemyClass} />
          {/* Floating damage numbers */}
          <AnimatePresence>
            {floats.map(f => (
              <FloatingDamage key={f.id} damage={f.damage} crit={f.crit} side={f.side} />
            ))}
          </AnimatePresence>
        </div>

        {/* ── Log — siempre visible, ocupa el espacio disponible ── */}
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1 min-h-0"
        >
          {(phase === 'done' && !keyMomentPause ? allEvents : shown).map((ev, i) => (
            <EventRow key={i} ev={ev} heroName={heroName} enemyName={enemyName} index={i} />
          ))}
          {phase === 'playing' && (
            <div className="px-3 py-1 text-[12px] text-text-3">
              <span className="animate-pulse">···</span>
            </div>
          )}
        </div>

        {/* ── Momento clave (reemplaza el footer) ── */}
        {phase === 'done' && keyMomentPause && (
          <KeyMomentPanel
            decisions={decisions}
            onDecide={onDecide}
            loading={resolving}
          />
        )}

        {/* ── Resultado — footer fijo bajo el log ── */}
        {phase === 'done' && !keyMomentPause && (
          <motion.div
            className="flex-shrink-0 border-t border-border bg-[var(--surface)] px-5 py-4 flex flex-col gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {enemyTactics?.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-3">Tácticas del rival</span>
                <div className="flex flex-wrap gap-1.5">
                  {enemyTactics.map((t, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-border rounded-lg text-[11px] font-semibold text-text-2"
                    >
                      {t.icon} {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <ResultPanel won={won} rewards={rewards} onClose={onClose} />
          </motion.div>
        )}

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
