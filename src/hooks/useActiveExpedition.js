import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useActiveExpedition(heroId) {
  const queryClient = useQueryClient()
  const key = queryKeys.activeExpedition(heroId)

  const { data: expedition, isLoading: loading, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!heroId) return null
      const { data } = await supabase
        .from('expeditions')
        .select('*, dungeons(name, duration_minutes, description)')
        .eq('hero_id', heroId)
        .eq('status', 'traveling')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
    enabled:   !!heroId,
    staleTime: 10_000,
  })

  // Realtime ahora gestionado por useRealtimeSync (centralizado en Dashboard)

  const setExpedition = useCallback((value) => {
    queryClient.setQueryData(key, value)
  }, [queryClient, key])

  return { expedition: expedition ?? undefined, loading, setExpedition, refetch }
}
