import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../../lib/notifications.js'
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
  const [collectingStats, setCollectingStats] = useState(() => new Set())

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
    mutationKey: ['training-build'],
    mutationFn: (stat) => apiPost('/api/training-room-build', { stat }),
    onError: err => notify.error(err.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trKey })
      queryClient.invalidateQueries({ queryKey: rsKey })
    },
  })

  const buildCollectMutation = useMutation({
    mutationKey: ['training-build-collect'],
    mutationFn: (stat) => apiPost('/api/training-room-build-collect', { stat }),
    onMutate: (stat) => {
      const prev = queryClient.getQueryData(trKey)
      queryClient.setQueryData(trKey, old => {
        if (!old) return old
        return old.map(r => {
          if (r.stat !== stat) return r
          const isInitial = r.built_at === null
          return isInitial
            ? { ...r, built_at: new Date().toISOString(), building_ends_at: null }
            : { ...r, level: r.level + 1, building_ends_at: null }
        })
      })
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(trKey, ctx.prev)
      notify.error(err.message)
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['training-build-collect'] }) === 0)
        queryClient.invalidateQueries({ queryKey: trKey })
    },
  })

  const upgradeMutation = useMutation({
    mutationKey: ['training-build'],
    mutationFn: (stat) => apiPost('/api/training-room-upgrade', { stat }),
    onError: err => notify.error(err.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trKey })
      queryClient.invalidateQueries({ queryKey: rsKey })
    },
  })

  const collectMutation = useMutation({
    mutationKey: ['training-collect'],
    mutationFn: (stat) => apiPost('/api/training-collect', { heroId, stat }),
    onMutate: (stat) => {
      setCollectingStats(prev => new Set([...prev, stat]))
      const prev = queryClient.getQueryData(tpKey)
      queryClient.setQueryData(tpKey, old => {
        if (!old) return old
        return old.map(r => r.stat === stat
          ? { ...r, xp_bank: 0, last_collected_at: new Date().toISOString() }
          : r
        )
      })
      return { prev }
    },
    onSuccess: () => {},
    onError: (err, stat, ctx) => {
      setCollectingStats(prev => { const n = new Set(prev); n.delete(stat); return n })
      if (ctx?.prev) queryClient.setQueryData(tpKey, ctx.prev)
      notify.error(err.message)
    },
    onSettled: (_, __, stat) => {
      setCollectingStats(prev => { const n = new Set(prev); n.delete(stat); return n })
      if (queryClient.isMutating({ mutationKey: ['training-collect'] }) === 0) {
        queryClient.invalidateQueries({ queryKey: tpKey })
        queryClient.invalidateQueries({ queryKey: ttKey })
      }
    },
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
            collectPending={collectingStats.has(room.stat)}
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
