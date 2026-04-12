import { useQuery } from '@tanstack/react-query'
import { apiPost } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'

/**
 * Estado de las rutas de Caza de Botín para un héroe.
 *
 * Llama al endpoint POST /api/bounty-state, que:
 *  - hace lazy-roll del pool si no existe o si reset_at ya pasó
 *  - devuelve las rutas, reset_at, regens usados y run activo
 *
 * Poll corto (10s) para mantener sincronizado el countdown y la expiración
 * del reset diario.
 */
export function useBountyState(heroId) {
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.bountyState(heroId),
    queryFn:  () => apiPost('/api/bounty-state', { heroId }),
    enabled:  !!heroId,
    staleTime: 10_000,
  })

  return {
    routes:      data?.routes ?? [],
    resetAt:     data?.resetAt ?? null,
    regensToday: data?.regensToday ?? 0,
    activeRun:   data?.activeRun ?? null,
    loading:     heroId ? loading : false,
    refetch,
  }
}
