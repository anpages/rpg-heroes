import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api'

// Clave estática — missions siempre es del usuario autenticado
const MISSIONS_KEY = ['missions', 'me']

export function useMissions() {
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: MISSIONS_KEY,
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
