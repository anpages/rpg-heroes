import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHero } from '../hooks/useHero'
import { useTowerProgress } from '../hooks/useTowerProgress'
import { Swords, Star, Coins, Sparkles, Trophy, ChevronUp, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './Torre.css'

const MILESTONES = [5, 10, 25, 50, 100]

const ENEMY_NAMES = [
  [1,  5,  'Guardián'],
  [6,  10, 'Centinela'],
  [11, 20, 'Campeón'],
  [21, 50, 'Élite'],
  [51, 999,'Legendario'],
]

function enemyName(floor) {
  return ENEMY_NAMES.find(([lo, hi]) => floor >= lo && floor <= hi)?.[2] ?? 'Guardián'
}

function floorEnemyStats(floor) {
  return {
    max_hp:       80  + floor * 15,
    attack:        5  + floor * 2,
    defense:       2  + floor * 1,
    strength:      2  + Math.floor(floor * 0.5),
    agility:       2  + Math.floor(floor * 0.3),
  }
}

function floorRewards(floor) {
  const milestone = floor % 5 === 0
  return {
    gold:       Math.round((30 + floor * 15) * (milestone ? 2 : 1)),
    experience: Math.round((20 + floor * 10) * (milestone ? 2 : 1)),
    milestone,
  }
}

/* ─── Progress strip ─────────────────────────────────────────────────────────── */

function ProgressStrip({ maxFloor }) {
  const reached = maxFloor ?? 0
  const nextMs  = MILESTONES.find(m => m > reached) ?? MILESTONES[MILESTONES.length - 1]
  const prevMs  = [...MILESTONES].reverse().find(m => m <= reached) ?? 0
  const pct     = nextMs === prevMs ? 100 : Math.min(100, Math.round(((reached - prevMs) / (nextMs - prevMs)) * 100))

  return (
    <div className="tower-progress-strip">
      <div className="tower-progress-top">
        <div className="tower-max-block">
          <Trophy size={15} color="#d97706" strokeWidth={2} />
          <span className="tower-max-num">{reached}</span>
          <span className="tower-max-label">piso máximo</span>
        </div>
        <span className="tower-next-ms">Hito: piso {nextMs}</span>
      </div>
      <div className="tower-ms-bar-wrap">
        <div className="tower-ms-track">
          <div className="tower-ms-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="tower-ms-dots">
          {MILESTONES.map(m => (
            <div key={m} className={`tower-ms-dot ${reached >= m ? 'tower-ms-dot--done' : ''}`} title={`Piso ${m}`}>
              <span className="tower-ms-dot-label">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Stat comparison row ────────────────────────────────────────────────────── */

function StatCompareRow({ label, heroVal, enemyVal }) {
  const heroWins  = heroVal > enemyVal
  const enemyWins = enemyVal > heroVal
  return (
    <div className="tower-cmp-row">
      <span className={`tower-cmp-val tower-cmp-val--hero ${heroWins ? 'tower-cmp-val--advantage' : enemyWins ? 'tower-cmp-val--disadvantage' : ''}`}>
        {heroVal}
      </span>
      <span className="tower-cmp-label">{label}</span>
      <span className={`tower-cmp-val tower-cmp-val--enemy ${enemyWins ? 'tower-cmp-val--advantage' : heroWins ? 'tower-cmp-val--disadvantage' : ''}`}>
        {enemyVal}
      </span>
    </div>
  )
}

/* ─── Result banner ──────────────────────────────────────────────────────────── */

function ResultBanner({ result, onClose }) {
  const { won, floor, rounds, heroHpLeft, heroMaxHp, enemyHpLeft, enemyMaxHp, rewards, knockedOut } = result
  const heroPct  = Math.max(0, Math.round((heroHpLeft  / heroMaxHp)  * 100))
  const enemyPct = Math.max(0, Math.round((enemyHpLeft / enemyMaxHp) * 100))

  return (
    <div className={`tower-result ${won ? 'tower-result--win' : 'tower-result--lose'}`}>
      <button className="tower-result-close" onClick={onClose} aria-label="Cerrar">
        <X size={15} strokeWidth={2} />
      </button>

      <div className="tower-result-headline">
        <span className="tower-result-icon">{won ? '⚔' : '💀'}</span>
        <div>
          <p className="tower-result-title">{won ? `Piso ${floor} superado` : `Derrotado en el piso ${floor}`}</p>
          <p className="tower-result-sub">
            {rounds} rondas · {won ? `${heroHpLeft} HP restante` : `Enemigo con ${enemyHpLeft} HP`}
            {knockedOut && ' · ¡Héroe derribado! Entrando en descanso.'}
          </p>
        </div>
      </div>

      <div className="tower-result-hpbars">
        <div className="tower-result-hpbar-row">
          <span className="tower-result-hpbar-label">Tú</span>
          <div className="tower-result-hpbar-track">
            <div className="tower-result-hpbar-fill tower-result-hpbar-fill--hero" style={{ width: `${heroPct}%` }} />
          </div>
          <span className="tower-result-hpbar-val">{heroHpLeft}/{heroMaxHp}</span>
        </div>
        <div className="tower-result-hpbar-row">
          <span className="tower-result-hpbar-label">Enemigo</span>
          <div className="tower-result-hpbar-track">
            <div className={`tower-result-hpbar-fill ${won ? 'tower-result-hpbar-fill--dead' : 'tower-result-hpbar-fill--enemy'}`} style={{ width: `${enemyPct}%` }} />
          </div>
          <span className="tower-result-hpbar-val">{enemyHpLeft}/{enemyMaxHp}</span>
        </div>
      </div>

      {won && rewards && (
        <div className="tower-result-loot">
          {rewards.milestone && <span className="tower-result-milestone">★ Hito · ×2</span>}
          <span className="tower-result-chip"><Coins size={12} color="#d97706" /> +{rewards.gold}</span>
          <span className="tower-result-chip"><Sparkles size={12} color="#7c3aed" /> +{rewards.experience} XP</span>
          {rewards.levelUp && <span className="tower-result-chip tower-result-chip--level">¡Nivel!</span>}
          {rewards.drop?.item_catalog && (
            <span className="tower-result-chip tower-result-chip--item">⚔ {rewards.drop.item_catalog.name}</span>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function Torre({ userId, heroId, onResourceChange }) {
  const { hero, loading: heroLoading, refetch: refetchHero } = useHero(heroId)
  const { maxFloor, loading: towerLoading, refetch: refetchTower } = useTowerProgress(hero?.id)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  const targetFloor = (maxFloor ?? 0) + 1
  const enemy       = floorEnemyStats(targetFloor)
  const rewards     = floorRewards(targetFloor)
  const isBusy      = hero?.status !== 'idle'

  async function attempt() {
    setLoading(true)
    setError(null)
    setResult(null)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res  = await fetch('/api/tower-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ heroId: hero?.id }),
    })
    const data = await res.json()
    if (res.ok) {
      setResult(data)
      await refetchTower()
      refetchHero()
      if (data.won) onResourceChange?.()
    } else {
      setError(data.error ?? 'Error al intentar el piso')
    }
    setLoading(false)
  }

  if (heroLoading || towerLoading) return <div className="tower-loading">Cargando torre...</div>

  const HERO_STATS = [
    { label: 'HP',  heroVal: hero?.max_hp   ?? 0, enemyVal: enemy.max_hp   },
    { label: 'Atq', heroVal: hero?.attack   ?? 0, enemyVal: enemy.attack   },
    { label: 'Def', heroVal: hero?.defense  ?? 0, enemyVal: enemy.defense  },
    { label: 'Fue', heroVal: hero?.strength ?? 0, enemyVal: enemy.strength },
    { label: 'Agi', heroVal: hero?.agility  ?? 0, enemyVal: enemy.agility  },
  ]

  const heroAdvantages = HERO_STATS.filter(s => s.heroVal > s.enemyVal).length

  return (
    <div className="torre-section">
      <div className="section-header">
        <h2 className="section-title">Torre de Desafíos</h2>
        <p className="section-subtitle">Escala la torre para medir el poder de tu héroe. Cada piso es más difícil que el anterior.</p>
      </div>

      <ProgressStrip maxFloor={maxFloor} />

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <ResultBanner result={result} onClose={() => setResult(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle panel */}
      <div className="tower-battle-panel">
        <div className="tower-battle-header">
          <div className="tower-floor-chip">
            <ChevronUp size={13} strokeWidth={2.5} />
            Piso {targetFloor}
          </div>
          <div className="tower-battle-header-right">
            {rewards.milestone && <span className="tower-milestone-badge"><Star size={10} strokeWidth={2} /> Hito</span>}
            <span className={`tower-prediction ${heroAdvantages >= 3 ? 'tower-prediction--good' : heroAdvantages >= 2 ? 'tower-prediction--neutral' : 'tower-prediction--hard'}`}>
              {heroAdvantages >= 3 ? 'Favorable' : heroAdvantages >= 2 ? 'Ajustado' : 'Difícil'}
            </span>
          </div>
        </div>

        {/* Combatants header */}
        <div className="tower-combatants-header">
          <span className="tower-combatant-name tower-combatant-name--hero">{hero?.name ?? '—'}</span>
          <span className="tower-vs">VS</span>
          <span className="tower-combatant-name tower-combatant-name--enemy">{enemyName(targetFloor)}</span>
        </div>

        {/* Stats comparison */}
        <div className="tower-stats-compare">
          {HERO_STATS.map(s => (
            <StatCompareRow key={s.label} {...s} />
          ))}
        </div>

        <p className="tower-stats-note">Stats base · el equipo añade bonificaciones en combate</p>

        {/* Rewards preview */}
        <div className="tower-rewards-preview">
          <span className="tower-reward-preview-item"><Coins size={13} color="#d97706" strokeWidth={2} />{rewards.gold} oro</span>
          <span className="tower-reward-preview-item"><Star size={13} color="#0369a1" strokeWidth={2} />{rewards.experience} XP</span>
          {rewards.milestone && <span className="tower-reward-preview-item tower-reward-preview-item--ms">×2 recompensas</span>}
        </div>

        {error && <p className="tower-error">{error}</p>}

        <motion.button
          className="btn btn--primary btn--lg btn--full"
          onClick={attempt}
          disabled={loading || isBusy}
          whileTap={loading || isBusy ? {} : { scale: 0.96 }}
          whileHover={loading || isBusy ? {} : { scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Swords size={16} strokeWidth={2} />
          {loading ? 'Combatiendo...' : isBusy ? 'Héroe ocupado' : `Intentar piso ${targetFloor}`}
        </motion.button>
      </div>
    </div>
  )
}
