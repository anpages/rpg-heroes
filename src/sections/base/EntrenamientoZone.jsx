import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../../lib/notifications.js'
import { motion } from 'framer-motion'
import { FlaskConical, Award } from 'lucide-react'
import { apiPost } from '../../lib/api.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { useHero } from '../../hooks/useHero.js'
import { useCraftedItems } from '../../hooks/useCraftedItems.js'
import { useTrainingTokens } from '../../hooks/useTrainingTokens.js'
import { hasReadyPoint } from '../../hooks/useTraining.js'
import { cardVariants, TRAINING_ROOMS, STAT_LABEL_MAP } from './constants.js'
import { baseLevelFromMap } from './helpers.js'
import RoomCard from './RoomCard.jsx'

export default function EntrenamientoZone({ trainingRooms, trainingProgress, resources, userId, heroId, byType, anyUpgrading }) {
  const queryClient = useQueryClient()
  const { hero } = useHero(heroId)
  const { inventory: craftedItems } = useCraftedItems(userId)
  const { tokens, totalTokens } = useTrainingTokens(userId)

  const baseLevel      = baseLevelFromMap(byType)
  const roomByStat     = Object.fromEntries(trainingRooms.map(r => [r.stat, r]))
  const progressByStat = Object.fromEntries(trainingProgress.map(r => [r.stat, r]))
  const builtRooms     = trainingRooms.filter(r => r.built_at !== null)
  const anyReady       = builtRooms.some(r => hasReadyPoint(progressByStat[r.stat], r.level))
  const needsInit      = heroId && builtRooms.some(r => !progressByStat[r.stat])

  const tonicQty      = craftedItems?.training_tonic ?? 0
  const hasBoost      = !!(hero?.active_effects?.training_boost)

  const isQueueBusy = anyUpgrading

  useEffect(() => {
    if (!needsInit) return
    apiPost('/api/training-collect', { heroId })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.training(heroId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.trainingTokens(userId) })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInit, heroId])

  const trKey = queryKeys.trainingRooms(userId)
  const tpKey = queryKeys.training(heroId)
  const ttKey = queryKeys.trainingTokens(userId)
  const rsKey = queryKeys.resources(userId)

  const buildMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-build', { stat }),
    onError: err => notify.error(err.message),
    onSettled: () => { queryClient.invalidateQueries({ queryKey: trKey }); queryClient.invalidateQueries({ queryKey: rsKey }) },
  })

  const buildCollectMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-build-collect', { stat }),
    onError: err => notify.error(err.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: trKey }),
  })

  const upgradeMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-upgrade', { stat }),
    onError: err => notify.error(err.message),
    onSettled: () => { queryClient.invalidateQueries({ queryKey: trKey }); queryClient.invalidateQueries({ queryKey: rsKey }) },
  })

  const collectMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-collect', { heroId, stat }),
    onSuccess: (data) => {
      const names = Object.entries(data.gained ?? {}).map(([stat, pts]) => `+${pts} token ${STAT_LABEL_MAP[stat]}`)
      if (names.length > 0) notify.success(`¡Entrenamiento! ${names.join(' · ')}`)
    },
    onError: err => notify.error(err.message),
    onSettled: () => { queryClient.invalidateQueries({ queryKey: tpKey }); queryClient.invalidateQueries({ queryKey: ttKey }) },
  })

  const tonicMutation = useMutation({
    mutationFn: () => apiPost('/api/training-tonic-use', { heroId }),
    onSuccess: () => notify.success('Tonico activado'),
    onError: err => notify.error(err.message),
    onSettled: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) }); queryClient.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) }) },
  })

  const mutPending = buildMutation.isPending || upgradeMutation.isPending || collectMutation.isPending

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-3">Salas de entrenamiento</p>
        {builtRooms.length > 0 && (
          <span className="text-[10px] font-semibold text-text-3">Produce tokens asignables a cualquier héroe</span>
        )}
      </div>

      {/* Tokens acumulados */}
      {totalTokens > 0 && (
        <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">
              <Award size={12} strokeWidth={2.5} className="text-[#d97706]" />
              Tokens disponibles
            </span>
            <span className="text-[11px] font-semibold text-[#d97706]">
              Asigna en la ficha del héroe
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {TRAINING_ROOMS.filter(r => (tokens[r.stat] ?? 0) > 0).map(r => (
              <span
                key={r.stat}
                className="flex items-center gap-1 px-2 py-1 rounded-md border text-[12px] font-semibold"
                style={{ borderColor: r.color, color: r.color, background: `color-mix(in srgb, ${r.color} 8%, var(--surface))` }}
              >
                {r.label}: {tokens[r.stat]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tónico de entrenamiento */}
      {builtRooms.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <FlaskConical size={14} strokeWidth={2} className="text-[#7c3aed] flex-shrink-0" />
            {hasBoost ? (
              <span className="text-[12px] font-semibold text-[#7c3aed]">Tónico activo — próxima recolección ×2 XP</span>
            ) : (
              <span className="text-[12px] text-text-3">
                Tónico de Entrenamiento: <span className="font-semibold text-text-2">{tonicQty}</span>
              </span>
            )}
          </div>
          {!hasBoost && (
            <motion.button
              className="px-2.5 py-1 text-[11px] font-bold rounded-md border-0 text-white bg-[#7c3aed] transition-opacity disabled:opacity-40 flex-shrink-0"
              onClick={() => tonicMutation.mutate()}
              disabled={tonicQty <= 0 || tonicMutation.isPending}
              whileTap={tonicQty > 0 ? { scale: 0.95 } : {}}
            >
              Usar
            </motion.button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TRAINING_ROOMS.map(room => (
          <RoomCard
            key={room.stat}
            room={room}
            roomData={roomByStat[room.stat]}
            progressRow={progressByStat[room.stat]}
            resources={resources}
            baseLevel={baseLevel}
            mutPending={mutPending}
            isQueueBusy={isQueueBusy}
            anyReady={anyReady}
            collectPending={collectMutation.isPending}
            onBuild={() => buildMutation.mutate(room.stat)}
            onUpgrade={() => upgradeMutation.mutate(room.stat)}
            onBuildCollect={() => buildCollectMutation.mutate(room.stat)}
            onCollect={() => collectMutation.mutate(room.stat)}
          />
        ))}
      </div>
    </motion.div>
  )
}
