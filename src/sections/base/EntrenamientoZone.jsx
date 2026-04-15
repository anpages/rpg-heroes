import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../../lib/notifications.js'
import { motion } from 'framer-motion'
import { apiPost } from '../../lib/api.js'
import { queryKeys } from '../../lib/queryKeys.js'
import { hasReadyPoint } from '../../hooks/useTraining.js'
import { trainingRoomUpgradeDurationMs } from '../../lib/gameConstants.js'
import { cardVariants, TRAINING_ROOMS, STAT_LABEL_MAP } from './constants.js'
import RoomCard from './RoomCard.jsx'

export default function EntrenamientoZone({ trainingRooms, trainingProgress, resources, userId, heroId, heroLevel, anyUpgrading, allowedStats, hero }) {
  const queryClient = useQueryClient()
  const roomByStat     = Object.fromEntries(trainingRooms.map(r => [r.stat, r]))
  const progressByStat = Object.fromEntries(trainingProgress.map(r => [r.stat, r]))
  const builtRooms     = trainingRooms.filter(r => r.built_at !== null)
  const anyReady       = builtRooms.some(r => hasReadyPoint(progressByStat[r.stat], r.level))
  const visibleRooms   = allowedStats ? TRAINING_ROOMS.filter(r => allowedStats.includes(r.stat)) : TRAINING_ROOMS

  const isQueueBusy = anyUpgrading
  const [collectingStats, setCollectingStats] = useState(() => new Set())

  const trKey = queryKeys.trainingRooms(userId)
  const tpKey = queryKeys.training(heroId)
  const hKey  = queryKeys.hero(heroId)
  const hsKey = queryKeys.heroes(userId)
  const rsKey = queryKeys.resources(userId)

  // Activar sala — instantáneo, sin coste
  const buildMutation = useMutation({
    mutationKey: ['training-build'],
    mutationFn: (stat) => apiPost('/api/training-room-build', { stat, heroId }),
    onMutate: (stat) => {
      const prev = queryClient.getQueryData(trKey)
      queryClient.setQueryData(trKey, old => [
        ...(old ?? []),
        { stat, level: 1, built_at: new Date().toISOString(), building_ends_at: null },
      ])
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(trKey, ctx.prev)
      notify.error(err.message)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: trKey }),
  })

  // Recoger upgrade completado
  const upgradeCollectMutation = useMutation({
    mutationKey: ['training-build-collect'],
    mutationFn: ({ stat }) => apiPost('/api/training-room-build-collect', { stat, heroId }),
    onMutate: ({ stat }) => {
      const prev = queryClient.getQueryData(trKey)
      queryClient.setQueryData(trKey, old => {
        if (!old) return old
        return old.map(r => r.stat !== stat ? r : { ...r, level: r.level + 1, building_ends_at: null })
      })
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(trKey, ctx.prev)
      notify.error(err.message)
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['training-build-collect'] }) === 0) {
        queryClient.invalidateQueries({ queryKey: trKey })
        queryClient.invalidateQueries({ queryKey: tpKey })
      }
    },
  })

  const upgradeMutation = useMutation({
    mutationKey: ['training-build'],
    mutationFn: (stat) => apiPost('/api/training-room-upgrade', { stat }),
    onMutate: (stat) => {
      const prev = queryClient.getQueryData(trKey)
      queryClient.setQueryData(trKey, old => (old ?? []).map(r => {
        if (r.stat !== stat) return r
        return { ...r, building_ends_at: new Date(Date.now() + trainingRoomUpgradeDurationMs(r.level)).toISOString() }
      }))
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(trKey, ctx.prev)
      notify.error(err.message)
    },
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
    onError: (err, stat, ctx) => {
      setCollectingStats(prev => { const n = new Set(prev); n.delete(stat); return n })
      if (ctx?.prev) queryClient.setQueryData(tpKey, ctx.prev)
      notify.error(err.message)
    },
    onSettled: (_, __, stat) => {
      setCollectingStats(prev => { const n = new Set(prev); n.delete(stat); return n })
      if (queryClient.isMutating({ mutationKey: ['training-collect'] }) === 0) {
        queryClient.invalidateQueries({ queryKey: tpKey })
        queryClient.invalidateQueries({ queryKey: hKey })
        queryClient.invalidateQueries({ queryKey: hsKey })
      }
    },
  })

  const mutPending = buildMutation.isPending || upgradeMutation.isPending || upgradeCollectMutation.isPending || collectMutation.isPending

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-3">Salas de entrenamiento</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visibleRooms.map(room => (
          <RoomCard
            key={room.stat}
            room={room}
            roomData={roomByStat[room.stat]}
            progressRow={progressByStat[room.stat]}
            resources={resources}
            heroLevel={heroLevel}
            mutPending={mutPending}
            isQueueBusy={isQueueBusy}
            anyReady={anyReady}
            collectPending={collectingStats.has(room.stat)}
            heroStatValue={hero ? hero[room.stat] ?? 0 : null}
            statLabel={STAT_LABEL_MAP[room.stat] ?? room.stat}
            onBuild={() => buildMutation.mutate(room.stat)}
            onUpgrade={() => upgradeMutation.mutate(room.stat)}
            onUpgradeCollect={() => upgradeCollectMutation.mutate({ stat: room.stat })}
            onCollect={() => collectMutation.mutate(room.stat)}
          />
        ))}
      </div>
    </motion.div>
  )
}
