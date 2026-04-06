import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Clave estática — missions siempre es del usuario autenticado
const MISSIONS_KEY = ['missions', 'me']

export function useMissions() {
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: MISSIONS_KEY,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { missions: [], secondsToReset: null }
      const res = await fetch('/api/missions-get', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return { missions: [], secondsToReset: null }
      return res.json()
    },
    staleTime: 60_000,
  })

  return {
    missions:       data?.missions ?? null,
    secondsToReset: data?.secondsToReset ?? null,
    loading,
    refetch,
  }
}
