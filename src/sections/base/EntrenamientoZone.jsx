import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PackageOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import { apiPost } from '../../lib/api.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { hasReadyPoint } from '../../hooks/useTraining.js'
import { cardVariants, TRAINING_ROOMS, STAT_LABEL_MAP } from './constants.js'
import { baseLevelFromMap } from './helpers.js'
import RoomCard from './RoomCard.jsx'

export default function EntrenamientoZone({ trainingRooms, trainingProgress, resources, userId, heroId, byType }) {
  const queryClient = useQueryClient()

  const baseLevel      = baseLevelFromMap(byType)
  const roomByStat     = Object.fromEntries(trainingRooms.map(r => [r.stat, r]))
  const progressByStat = Object.fromEntries(trainingProgress.map(r => [r.stat, r]))
  const builtRooms     = trainingRooms.filter(r => r.built_at !== null)
  const anyReady       = builtRooms.some(r => hasReadyPoint(progressByStat[r.stat], r.level))
  const needsInit      = heroId && builtRooms.length > 0 && trainingProgress.length === 0

  useEffect(() => {
    if (!needsInit) return
    apiPost('/api/training-collect', { heroId })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.training(heroId) }))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInit, heroId])

  const buildMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-build', { stat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      toast.success('¡Construcción iniciada!')
    },
    onError: err => toast.error(err.message),
  })

  const buildCollectMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-build-collect', { stat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) })
      toast.success('¡Sala lista!')
    },
    onError: err => toast.error(err.message),
  })

  const upgradeMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-upgrade', { stat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      toast.success('¡Sala mejorada!')
    },
    onError: err => toast.error(err.message),
  })

  const collectMutation = useMutation({
    mutationFn: () => apiPost('/api/training-collect', { heroId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.training(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      const names = Object.entries(data.gained ?? {}).map(([stat, pts]) => `+${pts} ${STAT_LABEL_MAP[stat]}`)
      toast.success(names.length > 0 ? `¡Entrenamiento! ${names.join(' · ')}` : 'Sincronizado')
    },
    onError: err => toast.error(err.message),
  })

  const mutPending = buildMutation.isPending || upgradeMutation.isPending || collectMutation.isPending

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-3">Salas de entrenamiento</p>
        {anyReady && (
          <motion.button
            className="btn btn--primary btn--sm"
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending}
            whileTap={{ scale: 0.96 }}
          >
            <PackageOpen size={13} strokeWidth={2} />
            Recoger todo
          </motion.button>
        )}
      </div>

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
            onBuild={() => buildMutation.mutate(room.stat)}
            onUpgrade={() => upgradeMutation.mutate(room.stat)}
            onBuildCollect={() => buildCollectMutation.mutate(room.stat)}
          />
        ))}
      </div>
    </motion.div>
  )
}
