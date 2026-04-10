import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { apiPost } from '../../lib/api.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { hasReadyPoint } from '../../hooks/useTraining.js'
import { cardVariants, TRAINING_ROOMS, STAT_LABEL_MAP } from './constants.js'
import { baseLevelFromMap } from './helpers.js'
import RoomCard from './RoomCard.jsx'

export default function EntrenamientoZone({ trainingRooms, trainingProgress, resources, userId, heroId, byType, anyUpgrading }) {
  const queryClient = useQueryClient()

  const baseLevel      = baseLevelFromMap(byType)
  const roomByStat     = Object.fromEntries(trainingRooms.map(r => [r.stat, r]))
  const progressByStat = Object.fromEntries(trainingProgress.map(r => [r.stat, r]))
  const builtRooms     = trainingRooms.filter(r => r.built_at !== null)
  const anyReady       = builtRooms.some(r => hasReadyPoint(progressByStat[r.stat], r.level))
  const needsInit      = heroId && builtRooms.some(r => !progressByStat[r.stat])

  const isQueueBusy = anyUpgrading

  useEffect(() => {
    if (!needsInit) return
    apiPost('/api/training-collect', { heroId })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.training(heroId) }))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInit, heroId])

  const buildMutation = useMutation({
    mutationFn: async (stat) => {
      await apiPost('/api/training-room-build', { stat })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.trainingRooms(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
      ])
    },
    onSuccess: () => toast.success('¡Construcción iniciada!'),
    onError: err => toast.error(err.message),
  })

  const buildCollectMutation = useMutation({
    mutationFn: async (stat) => {
      await apiPost('/api/training-room-build-collect', { stat })
      await queryClient.refetchQueries({ queryKey: queryKeys.trainingRooms(userId) })
    },
    onSuccess: () => toast.success('¡Sala lista!'),
    onError: err => toast.error(err.message),
  })

  const upgradeMutation = useMutation({
    mutationFn: async (stat) => {
      await apiPost('/api/training-room-upgrade', { stat })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.trainingRooms(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
      ])
    },
    onSuccess: () => toast.success('¡Sala mejorada!'),
    onError: err => toast.error(err.message),
  })

  const collectMutation = useMutation({
    mutationFn: async (stat) => {
      const data = await apiPost('/api/training-collect', { heroId, stat })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.training(heroId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.hero(heroId) }),
      ])
      return data
    },
    onSuccess: (data) => {
      const names = Object.entries(data.gained ?? {}).map(([stat, pts]) => `+${pts} ${STAT_LABEL_MAP[stat]}`)
      toast.success(names.length > 0 ? `¡Entrenamiento! ${names.join(' · ')}` : 'Sincronizado')
    },
    onError: err => toast.error(err.message),
  })

  const mutPending = buildMutation.isPending || upgradeMutation.isPending || collectMutation.isPending

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-3">Salas de entrenamiento</p>

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
