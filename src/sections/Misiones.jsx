import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useMissions } from '../hooks/useMissions'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { MISSION_POOL } from '../lib/missionPool.js'
import { Coins, Star, Clock, CheckCircle2, Circle } from 'lucide-react'
import { motion } from 'framer-motion'

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
      await queryClient.cancelQueries({ queryKey: queryKeys.missions() })
      const previous = queryClient.getQueryData(queryKeys.missions())
      queryClient.setQueryData(queryKeys.missions(), (old) => old
        ? { ...old, missions: old.missions.map(m => m.id === mission.id ? { ...m, claimed: true } : m) }
        : old
      )
      return { previous }
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(queryKeys.missions(), context.previous)
      toast.error(err.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions() })
    },
  })

  const def = MISSION_POOL.find(p => p.type === mission.type)
  if (!def) return null

  const pct      = Math.min(100, Math.round((mission.current_value / mission.target_value) * 100))
  const label    = def.description(mission.target_value)
  const isClaimed = mission.claimed || claimMutation.isSuccess

  return (
    <div className={`bg-surface border border-border rounded-xl p-4 flex flex-col gap-[0.65rem] shadow-[var(--shadow-sm)] transition-[border-color,background] duration-200
      ${isClaimed ? 'bg-surface-2 opacity-70' : mission.completed ? 'border-info-border bg-info-bg' : ''}`}>

      {/* Top row */}
      <div className="flex items-start gap-[0.65rem]">
        <div className="mt-px flex-shrink-0">
          {isClaimed
            ? <CheckCircle2 size={18} color="#16a34a" strokeWidth={2} />
            : mission.completed
              ? <CheckCircle2 size={18} color="#2563eb" strokeWidth={2} />
              : <Circle size={18} color="var(--text-3)" strokeWidth={1.5} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[0.85rem] font-bold text-text">{def.label}</span>
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.04em]" style={{ color: TIER_COLORS[mission.tier] }}>
              {TIER_LABELS[mission.tier]}
            </span>
          </div>
          <p className="text-[0.78rem] text-text-2">{label}</p>
        </div>
      </div>

      {/* Progress bar */}
      {!isClaimed && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-[400ms] ease-out ${mission.completed ? 'bg-[#16a34a]' : 'bg-[var(--blue-500)]'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[0.7rem] text-text-3 whitespace-nowrap">{mission.current_value}/{mission.target_value}</span>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-[0.35rem] flex-wrap">
          {mission.reward_gold > 0 && (
            <span className="flex items-center gap-1 text-[0.72rem] font-semibold text-text-2 bg-surface-2 border border-border px-[7px] py-0.5 rounded-full">
              <Coins size={11} color="#d97706" strokeWidth={2} />
              {mission.reward_gold}
            </span>
          )}
{mission.reward_xp > 0 && (
            <span className="flex items-center gap-1 text-[0.72rem] font-semibold text-text-2 bg-surface-2 border border-border px-[7px] py-0.5 rounded-full">
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
          <span className="text-[0.72rem] text-text-3 font-medium">Reclamada</span>
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
    <span className="flex items-center gap-1.5 text-[0.72rem] text-text-3 whitespace-nowrap mt-1">
      <Clock size={12} strokeWidth={2} />
      Resetea en {fmtTime(remaining)}
    </span>
  )
}

export default function Misiones() {
  const { missions, secondsToReset, loading } = useMissions()

  if (loading) return <div className="p-8 text-text-3 text-center text-[0.9rem]">Cargando misiones...</div>

  const allClaimed = missions?.every(m => m.claimed)

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="section-title">Misiones del día</h2>
            <p className="section-subtitle">Completa los objetivos diarios para obtener recompensas extra.</p>
          </div>
          {secondsToReset > 0 && <ResetTimer seconds={secondsToReset} />}
        </div>
      </div>

      {allClaimed && (
        <div className="flex items-center gap-2.5 px-4 py-[0.9rem] bg-success-bg border border-success-border rounded-xl text-[0.85rem] text-success-text font-medium">
          <CheckCircle2 size={20} color="#16a34a" strokeWidth={2} />
          <p>¡Todas las misiones completadas! Vuelve mañana para nuevos objetivos.</p>
        </div>
      )}

      <motion.div
        className="flex flex-col gap-3"
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
