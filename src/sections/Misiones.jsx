import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useMissions } from '../hooks/useMissions'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
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

function MissionCard({ mission }) {
  const userId      = useAppStore(s => s.userId)
  const queryClient = useQueryClient()

  // Hook debe estar ANTES de cualquier return condicional (Rules of Hooks)
  const claimMutation = useMutation({
    mutationFn: () => apiPost('/api/missions-claim', { missionId: mission.id }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['missions', 'me'] })
      const previous = queryClient.getQueryData(['missions', 'me'])
      queryClient.setQueryData(['missions', 'me'], (old) => old
        ? { ...old, missions: old.missions.map(m => m.id === mission.id ? { ...m, claimed: true } : m) }
        : old
      )
      return { previous }
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(['missions', 'me'], context.previous)
      toast.error(err.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['missions', 'me'] })
    },
  })

  const def = MISSION_POOL.find(p => p.type === mission.type)
  if (!def) return null

  const pct   = Math.min(100, Math.round((mission.current_value / mission.target_value) * 100))
  const label = def.description(mission.target_value)
  const isClaimed = mission.claimed || claimMutation.isSuccess

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
            className="btn btn--primary btn--sm"
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {claimMutation.isPending ? 'Reclamando...' : 'Reclamar'}
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

export default function Misiones() {
  const { missions, secondsToReset, loading } = useMissions()

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
            <MissionCard mission={m} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
