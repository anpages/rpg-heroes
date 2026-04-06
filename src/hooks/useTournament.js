import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'

export function useTournament(heroId) {
  return useQuery({
    queryKey: queryKeys.tournament(heroId),
    queryFn:  () => apiGet(`/api/tournament-status?heroId=${heroId}`),
    enabled:  !!heroId,
    staleTime: 10_000,
  })
}
