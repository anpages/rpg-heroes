import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { apiGet } from '../lib/api'

/**
 * Hook para inventario de items crafteados + cola de crafteo + catálogo.
 */
export function useCraftedItems(userId) {
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.craftedItems(userId),
    queryFn: () => apiGet('/api/crafted-items'),
    enabled: !!userId,
    staleTime: 30_000,
  })

  return {
    catalog:       data?.catalog       ?? [],
    inventory:     data?.inventory     ?? {},
    queue:         data?.queue         ?? [],
    refiningSlots: data?.refiningSlots ?? [],
    loading,
    refetch,
  }
}
