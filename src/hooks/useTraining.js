import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { xpThreshold, xpRateForLevel, TRAINING_XP_CAP_HOURS } from '../lib/gameConstants.js'

// Re-exportar para que los consumidores solo importen de este hook
export { xpThreshold }

/** Horas transcurridas desde last_collected_at, con cap anti-AFK */
function pendingHours(lastCollectedAt) {
  const elapsed = (Date.now() - new Date(lastCollectedAt).getTime()) / 3_600_000
  return Math.min(TRAINING_XP_CAP_HOURS, elapsed)
}

/**
 * XP actual interpolada (bank + acumulación desde última recogida).
 * Requiere el nivel de sala para aplicar la tasa correcta.
 */
export function currentXp(row, roomLevel = 1) {
  if (!row) return 0
  const rate = xpRateForLevel(roomLevel)
  return row.xp_bank + pendingHours(row.last_collected_at) * rate
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
