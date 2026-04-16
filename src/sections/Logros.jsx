import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../store/appStore'
import { useAchievements } from '../hooks/useAchievements'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { notify } from '../lib/notifications'
import { Coins, Sparkles, Droplets, ScrollText, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

const CATEGORY_LABELS = {
  progression: 'Progresión',
  tower:       'Torre',
  expeditions: 'Expediciones',
  tactics:     'Tácticas',
  equipment:   'Equipo',
}
const CATEGORY_ORDER = ['progression', 'tower', 'expeditions', 'tactics', 'equipment']
const CATEGORY_COLORS = {
  progression: '#d97706',
  tower:       '#f59e0b',
  expeditions: '#16a34a',
  tactics:     '#7c3aed',
  equipment:   '#2563eb',
}

function RewardBadges({ gold, fragments, essence, scroll }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {gold > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-text-2 bg-surface-2 border border-border px-1.5 py-px rounded-full">
          <Coins size={10} color="#d97706" strokeWidth={2} />{gold}
        </span>
      )}
      {fragments > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-text-2 bg-surface-2 border border-border px-1.5 py-px rounded-full">
          <Sparkles size={10} color="#f59e0b" strokeWidth={2} />{fragments}
        </span>
      )}
      {essence > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-text-2 bg-surface-2 border border-border px-1.5 py-px rounded-full">
          <Droplets size={10} color="#8b5cf6" strokeWidth={2} />{essence}
        </span>
      )}
      {scroll > 0 && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-text-2 bg-surface-2 border border-border px-1.5 py-px rounded-full">
          <ScrollText size={10} color="#16a34a" strokeWidth={2} />Pergamino
        </span>
      )}
    </div>
  )
}

function AchievementCard({ achievement }) {
  const userId      = useAppStore(s => s.userId)
  const queryClient = useQueryClient()

  const claimMutation = useMutation({
    mutationFn: () => apiPost('/api/achievements-claim', { achievementId: achievement.id }),
    onMutate: async () => {
      const key = queryKeys.achievements(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, old => old
        ? { ...old, achievements: old.achievements.map(a => a.id === achievement.id ? { ...a, claimed: true } : a) }
        : old
      )
      return { previous }
    },
    onError: (err, _, ctx) => {
      queryClient.setQueryData(queryKeys.achievements(userId), ctx.previous)
      notify.error(err.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.achievements(userId) })
    },
  })

  const { completed, claimed, current, condition_value } = achievement
  const isClaimed = claimed || claimMutation.isSuccess
  const pct = Math.min(100, Math.round((current / condition_value) * 100))

  return (
    <div className={`bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5 shadow-[var(--shadow-sm)] transition-[border-color,background] duration-200
      ${isClaimed ? 'opacity-60' : completed ? 'border-[color-mix(in_srgb,#16a34a_40%,var(--border))] bg-[color-mix(in_srgb,#16a34a_4%,var(--surface))]' : ''}`}>

      <div className="flex items-start gap-3">
        <span className="text-[22px] leading-none flex-shrink-0 mt-0.5">{achievement.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-text">{achievement.name}</span>
            {isClaimed && <CheckCircle2 size={13} color="#16a34a" strokeWidth={2.5} />}
          </div>
          <p className="text-[11px] text-text-3 mt-0.5">{achievement.description}</p>
        </div>
      </div>

      {!isClaimed && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${completed ? 'bg-[#16a34a]' : 'bg-[var(--blue-500)]'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-text-3 whitespace-nowrap tabular-nums">{current}/{condition_value}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <RewardBadges
          gold={achievement.reward_gold}
          fragments={achievement.reward_fragments}
          essence={achievement.reward_essence}
          scroll={achievement.reward_scroll}
        />
        {completed && !isClaimed && (
          <motion.button
            className="btn btn--primary btn--sm flex-shrink-0"
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            whileTap={{ scale: 0.96 }}
          >
            {claimMutation.isPending ? '...' : 'Reclamar'}
          </motion.button>
        )}
        {isClaimed && <span className="text-[10px] text-text-3">Reclamado</span>}
      </div>
    </div>
  )
}

export default function Logros() {
  const { achievements, loading } = useAchievements()

  if (loading) return <div className="p-10 text-text-3 text-center text-[14px]">Cargando logros...</div>

  const byCategory = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = (achievements ?? []).filter(a => a.category === cat)
    return acc
  }, {})

  const totalClaimed   = (achievements ?? []).filter(a => a.claimed).length
  const total          = (achievements ?? []).length

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="section-header">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="section-title">Logros</h2>
            <p className="section-subtitle">Hitos del reino y recompensas por tus hazañas.</p>
          </div>
          {total > 0 && (
            <span className="text-[12px] text-text-3 font-medium whitespace-nowrap mt-1">
              {totalClaimed}/{total} reclamados
            </span>
          )}
        </div>
      </div>

      {CATEGORY_ORDER.map(cat => {
        const items = byCategory[cat]
        if (!items?.length) return null
        const color = CATEGORY_COLORS[cat]
        return (
          <div key={cat} className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color }}>
              {CATEGORY_LABELS[cat]}
            </h3>
            {items.map(a => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
