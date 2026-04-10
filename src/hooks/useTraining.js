import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { xpThreshold, xpRateForLevel } from '../lib/gameConstants.js'

// Re-exportar para que los consumidores solo importen de este hook
export { xpThreshold }

/**
 * XP actual interpolada (bank + acumulación desde última recogida).
 * Se para al llegar al umbral — no sigue acumulando después.
 */
export function currentXp(row, roomLevel = 1) {
  if (!row) return 0
  const rate = xpRateForLevel(roomLevel)
  const thr  = xpThreshold(row.total_gained)

  // Horas necesarias para llegar al umbral desde el bank
  const hoursToThreshold = Math.max(0, (thr - row.xp_bank) / rate)
  const hoursElapsed     = (Date.now() - new Date(row.last_collected_at).getTime()) / 3_600_000
  const effectiveHours   = Math.min(hoursElapsed, hoursToThreshold)

  return row.xp_bank + effectiveHours * rate
}

/** Progreso [0-1] hacia el siguiente punto */
export function xpProgress(row, roomLevel = 1) {
  if (!row) return 0
  const xp  = currentXp(row, roomLevel)
  const thr = xpThreshold(row.total_gained)
  return Math.min(1, xp / thr)
}

/** true si hay XP suficiente para al menos 1 punto de stat */
export function hasReadyPoint(row, roomLevel = 1) {
  return row ? currentXp(row, roomLevel) >= xpThreshold(row.total_gained) : false
}

export function useTraining(heroId) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey:  queryKeys.training(heroId),
    queryFn:   async () => {
      const { data } = await supabase
        .from('hero_training')
        .select('*')
        .eq('hero_id', heroId)
      return data ?? []
    },
    enabled:   !!heroId,
    staleTime: 30_000,
  })

  return { rows, loading: heroId ? isLoading : false }
}
