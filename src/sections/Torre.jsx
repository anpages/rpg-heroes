import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHero } from '../hooks/useHero'
import { useTowerProgress } from '../hooks/useTowerProgress'
import { Swords, Shield, Zap, Brain, Wind, Heart, Star, ChevronUp, Coins, Sparkles, Trophy } from 'lucide-react'
import './Torre.css'

function floorEnemyStats(floor) {
  return {
    max_hp:       80  + floor * 15,
    attack:        5  + floor * 2,
    defense:       2  + floor * 1,
    strength:      2  + Math.floor(floor * 0.5),
    agility:       2  + Math.floor(floor * 0.3),
    intelligence:  1  + Math.floor(floor * 0.3),
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

function StatRow({ icon: Icon, label, value, color }) {
  return (
    <div className="tower-stat-row">
      <Icon size={13} color={color} strokeWidth={2} />
      <span className="tower-stat-label">{label}</span>
      <span className="tower-stat-value">{value}</span>
    </div>
  )
}

function FloorProgress({ maxFloor }) {
  const milestones = [5, 10, 25, 50, 100]
  const nextMilestone = milestones.find(m => m > maxFloor) ?? milestones[milestones.length - 1]
  const prevMilestone = milestones.slice().reverse().find(m => m <= maxFloor) ?? 0
  const pct = Math.min(100, Math.round(((maxFloor - prevMilestone) / (nextMilestone - prevMilestone)) * 100))

  return (
    <div className="tower-floor-progress">
      <div className="tower-floor-track">
        <div className="tower-floor-fill" style={{ width: `${pct}%` }} />
        {milestones.map(m => (
          <div
            key={m}
            className={`tower-milestone-dot ${maxFloor >= m ? 'tower-milestone-dot--reached' : ''}`}
            style={{ left: `${Math.min(100, Math.round((m / milestones[milestones.length - 1]) * 100))}%` }}
            title={`Piso ${m}`}
          />
        ))}
      </div>
      <div className="tower-floor-labels">
        <span>Piso {prevMilestone}</span>
        <span>Siguiente hito: piso {nextMilestone}</span>
      </div>
    </div>
  )
}

function ResultBanner({ result, onClose }) {
  if (!result) return null
  const { won, floor, rounds, heroHpLeft, heroMaxHp, enemyHpLeft, enemyMaxHp, rewards } = result

  return (
    <div className={`tower-result ${won ? 'tower-result--win' : 'tower-result--lose'}`}>
      <div className="tower-result-header">
        <span className="tower-result-icon">{won ? '⚔️' : '💀'}</span>
        <div>
          <p className="tower-result-title">{won ? `Piso ${floor} superado` : `Derrotado en el piso ${floor}`}</p>
          <p className="tower-result-sub">{rounds} rondas · {won ? `${heroHpLeft} HP restante` : `Enemigo con ${enemyHpLeft} HP`}</p>
        </div>
        <button className="tower-result-close" onClick={onClose}>×</button>
      </div>

      <div className="tower-result-bars">
        <div className="tower-result-bar-wrap">
          <span className="tower-result-bar-label">Tu héroe</span>
          <div className="tower-result-bar-track">
            <div
              className={`tower-result-bar-fill ${won ? 'tower-result-bar-fill--hero' : 'tower-result-bar-fill--dead'}`}
              style={{ width: `${Math.round((heroHpLeft / heroMaxHp) * 100)}%` }}
            />
          </div>
          <span className="tower-result-bar-val">{heroHpLeft}/{heroMaxHp}</span>
        </div>
        <div className="tower-result-bar-wrap">
          <span className="tower-result-bar-label">Enemigo</span>
          <div className="tower-result-bar-track">
            <div
              className={`tower-result-bar-fill ${!won ? 'tower-result-bar-fill--enemy' : 'tower-result-bar-fill--dead'}`}
              style={{ width: `${Math.round((enemyHpLeft / enemyMaxHp) * 100)}%` }}
            />
          </div>
          <span className="tower-result-bar-val">{enemyHpLeft}/{enemyMaxHp}</span>
        </div>
      </div>

      {won && rewards && (
        <div className="tower-result-rewards">
          {rewards.milestone && <span className="tower-result-milestone"><Star size={12} /> Hito · recompensas ×2</span>}
          <span className="tower-reward-chip"><Coins size={12} color="#d97706" /> +{rewards.gold}</span>
          <span className="tower-reward-chip"><Sparkles size={12} color="#7c3aed" /> +{rewards.experience} XP</span>
          {rewards.levelUp && <span className="tower-reward-chip tower-reward-chip--levelup">¡Nivel!</span>}
        </div>
      )}
    </div>
  )
}

export default function Torre({ userId, heroId }) {
  const { hero, loading: heroLoading, refetch: refetchHero } = useHero(heroId)
  const { maxFloor, loading: towerLoading, refetch: refetchTower } = useTowerProgress(hero?.id)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  const targetFloor = (maxFloor ?? 0) + 1
  const enemy = floorEnemyStats(targetFloor)
  const rewards = floorRewards(targetFloor)
  const isBusy = hero?.status !== 'idle'

  async function attempt() {
    setLoading(true)
    setError(null)
    setResult(null)

    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/tower-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ heroId: hero?.id }),
    })
    const data = await res.json()

    if (res.ok) {
      setResult(data)
      await refetchTower()
      if (data.won) refetchHero()
    } else {
      setError(data.error ?? 'Error al intentar el piso')
    }
    setLoading(false)
  }

  if (heroLoading || towerLoading) return <div className="tower-loading">Cargando torre...</div>

  return (
    <div className="torre-section">
      <div className="section-header">
        <h2 className="section-title">Torre de Desafíos</h2>
        <p className="section-subtitle">Escala la torre para medir el poder real de tu héroe. Cada piso es más difícil que el anterior.</p>
      </div>

      {/* Progreso */}
      <div className="tower-header-card">
        <div className="tower-floor-badge">
          <Trophy size={18} color="#d97706" strokeWidth={1.8} />
          <div>
            <p className="tower-floor-max">Piso {maxFloor ?? 0}</p>
            <p className="tower-floor-max-label">máximo alcanzado</p>
          </div>
        </div>
        <FloorProgress maxFloor={maxFloor ?? 0} />
      </div>

      <ResultBanner result={result} onClose={() => setResult(null)} />

      {/* Intento */}
      <div className="tower-attempt-card">
        <div className="tower-attempt-header">
          <div className="tower-floor-number">
            <ChevronUp size={14} strokeWidth={2.5} />
            Piso {targetFloor}
          </div>
          {rewards.milestone && (
            <span className="tower-milestone-badge">
              <Star size={11} /> Hito
            </span>
          )}
        </div>

        <div className="tower-enemy-grid">
          <div className="tower-enemy-block">
            <p className="tower-block-title">Enemigo</p>
            <StatRow icon={Heart}  label="HP"  value={enemy.max_hp}       color="#dc2626" />
            <StatRow icon={Swords} label="Atq" value={enemy.attack}       color="#d97706" />
            <StatRow icon={Shield} label="Def" value={enemy.defense}      color="#0369a1" />
            <StatRow icon={Zap}    label="Fue" value={enemy.strength}     color="#dc2626" />
            <StatRow icon={Wind}   label="Agi" value={enemy.agility}      color="#0369a1" />
            <StatRow icon={Brain}  label="Int" value={enemy.intelligence} color="#7c3aed" />
          </div>

          <div className="tower-reward-block">
            <p className="tower-block-title">Recompensas</p>
            <div className="tower-reward-list">
              <div className="tower-reward-item">
                <Coins size={14} color="#d97706" strokeWidth={2} />
                <span>{rewards.gold} oro</span>
              </div>
              <div className="tower-reward-item">
                <Sparkles size={14} color="#7c3aed" strokeWidth={2} />
                <span>{rewards.experience} XP</span>
              </div>
              {rewards.milestone && (
                <p className="tower-reward-milestone-note">Recompensas dobles por ser piso hito</p>
              )}
            </div>
          </div>
        </div>

        {error && <p className="tower-error">{error}</p>}

        <button
          className="tower-attempt-btn"
          onClick={attempt}
          disabled={loading || isBusy}
        >
          {loading ? 'Combatiendo...' : isBusy ? 'Héroe ocupado' : `Intentar piso ${targetFloor}`}
        </button>
      </div>
    </div>
  )
}
