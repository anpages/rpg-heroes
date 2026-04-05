import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useMissions } from '../hooks/useMissions'
import { MISSION_POOL } from '../lib/missionPool.js'
import { Coins, Sparkles, Star, Clock, CheckCircle2, Circle } from 'lucide-react'
import { motion } from 'framer-motion'
import './Misiones.css'

const listVariants = {
  animate: { transition: { staggerChildren: 0.06 } },
}
const cardVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

const TIER_LABELS = ['Fácil', 'Medio', 'Difícil']
const TIER_COLORS = ['#16a34a', '#d97706', '#dc2626']

function fmtTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function MissionCard({ mission, onClaim }) {
  const [claiming, setClaiming]               = useState(false)
  const [optimisticClaimed, setOptimisticClaimed] = useState(false)
  const def = MISSION_POOL.find(p => p.type === mission.type)
  if (!def) return null

  const isClaimed = mission.claimed || optimisticClaimed
  const pct = Math.min(100, Math.round((mission.current_value / mission.target_value) * 100))
  const label = def.description(mission.target_value)

  async function handleClaim() {
    setClaiming(true)
    setOptimisticClaimed(true)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/missions-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ missionId: mission.id }),
    })
    if (res.ok) {
      onClaim()
    } else {
      setOptimisticClaimed(false)
    }
    setClaiming(false)
  }

  return (
    <div className={`mission-card ${isClaimed ? 'mission-card--claimed' : mission.completed ? 'mission-card--completed' : ''}`}>
      <div className="mission-card-top">
        <div className="mission-icon-wrap">
          {isClaimed
            ? <CheckCircle2 size={18} color="#16a34a" strokeWidth={2} />
            : mission.completed
              ? <CheckCircle2 size={18} color="#2563eb" strokeWidth={2} />
              : <Circle size={18} color="var(--text-3)" strokeWidth={1.5} />
          }
        </div>
        <div className="mission-info">
          <div className="mission-name-row">
            <span className="mission-name">{def.label}</span>
            <span className="mission-tier" style={{ color: TIER_COLORS[mission.tier] }}>
              {TIER_LABELS[mission.tier]}
            </span>
          </div>
          <p className="mission-desc">{label}</p>
        </div>
      </div>

      {!isClaimed && (
        <div className="mission-progress-wrap">
          <div className="mission-progress-track">
            <div className="mission-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="mission-progress-text">{mission.current_value}/{mission.target_value}</span>
        </div>
      )}

      <div className="mission-card-bottom">
        <div className="mission-rewards">
          {mission.reward_gold > 0 && (
            <span className="mission-reward-chip">
              <Coins size={11} color="#d97706" strokeWidth={2} />
              {mission.reward_gold}
            </span>
          )}
          {mission.reward_mana > 0 && (
            <span className="mission-reward-chip">
              <Sparkles size={11} color="#7c3aed" strokeWidth={2} />
              {mission.reward_mana}
            </span>
          )}
          {mission.reward_xp > 0 && (
            <span className="mission-reward-chip">
              <Star size={11} color="#0369a1" strokeWidth={2} />
              {mission.reward_xp} XP
            </span>
          )}
        </div>

        {mission.completed && !isClaimed && (
          <motion.button
            className="mission-claim-btn"
            onClick={handleClaim}
            disabled={claiming}
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {claiming ? 'Reclamando...' : 'Reclamar'}
          </motion.button>
        )}
        {isClaimed && (
          <span className="mission-claimed-label">Reclamada</span>
        )}
      </div>
    </div>
  )
}

function ResetTimer({ seconds }) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    setRemaining(seconds)
    const interval = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(interval)
  }, [seconds])

  return (
    <span className="missions-reset-timer">
      <Clock size={12} strokeWidth={2} />
      Resetea en {fmtTime(remaining)}
    </span>
  )
}

export default function Misiones({ onResourceChange }) {
  const { missions, secondsToReset, loading, refetch } = useMissions()

  if (loading) return <div className="missions-loading">Cargando misiones...</div>

  const allClaimed = missions?.every(m => m.claimed)

  return (
    <div className="misiones-section">
      <div className="section-header">
        <div className="missions-header-row">
          <div>
            <h2 className="section-title">Misiones del día</h2>
            <p className="section-subtitle">Completa los objetivos diarios para obtener recompensas extra.</p>
          </div>
          {secondsToReset > 0 && <ResetTimer seconds={secondsToReset} />}
        </div>
      </div>

      {allClaimed && (
        <div className="missions-all-done">
          <CheckCircle2 size={20} color="#16a34a" strokeWidth={2} />
          <p>¡Todas las misiones completadas! Vuelve mañana para nuevos objetivos.</p>
        </div>
      )}

      <motion.div
        className="missions-list"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        {missions?.map(m => (
          <motion.div key={m.id} variants={cardVariants}>
            <MissionCard mission={m} onClaim={() => { refetch(); onResourceChange?.() }} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
