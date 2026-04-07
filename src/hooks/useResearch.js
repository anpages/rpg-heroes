import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { apiGet } from '../lib/api'

/**
 * Obtiene el estado de investigación del jugador.
 * Devuelve: { completed: string[], active: { node_id, ends_at, started_at } | null }
 */
export function useResearch(userId) {
  const { data, isLoading, ...rest } = useQuery({
    queryKey: queryKeys.research(userId),
    queryFn:  () => apiGet('/api/player-research'),
    enabled:  !!userId,
    staleTime: 30_000,
  })

  return {
    research: data ?? { completed: [], active: null },
    loading:  userId ? isLoading : false,
    ...rest,
  }
}
