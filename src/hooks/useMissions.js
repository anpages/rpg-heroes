import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'

export function useMissions() {
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.missions(),
    queryFn: () => apiGet('/api/missions-get'),
    staleTime: 60_000,
  })

  return {
    missions:       data?.missions ?? null,
    secondsToReset: data?.secondsToReset ?? null,
    loading,
    refetch,
  }
}
