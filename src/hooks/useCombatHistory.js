import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'

export function useCombatHistory(heroId) {
  return useQuery({
    queryKey: queryKeys.combatHistory(heroId),
    queryFn:  () => apiGet(`/api/combat-history?heroId=${heroId}`).then(r => r.combats),
    enabled:  !!heroId,
    staleTime: 30_000,
  })
}
