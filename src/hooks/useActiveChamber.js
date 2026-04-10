import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

/**
 * Hook para la cámara activa de un héroe.
 * Una cámara está "activa" mientras su status no sea 'completed':
 *   - 'active'           → corriendo, esperando ends_at
 *   - 'awaiting_choice'  → terminada, esperando elección de cofre
 */
export function useActiveChamber(heroId) {
  const queryClient = useQueryClient()
  const key = queryKeys.activeChamber(heroId)

  const { data: chamber, isLoading: loading, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!heroId) return null
      const { data } = await supabase
        .from('chamber_runs')
        .select('*')
        .eq('hero_id', heroId)
        .in('status', ['active', 'awaiting_choice'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
    enabled:   !!heroId,
    staleTime: 10_000,
  })

  // Realtime: cualquier cambio en chamber_runs del héroe dispara refetch
  useEffect(() => {
    if (!heroId) return
    const channel = supabase
      .channel(`chambers:${heroId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chamber_runs', filter: `hero_id=eq.${heroId}` },
        () => refetch(),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [heroId, refetch])

  const setChamber = useCallback((value) => {
    queryClient.setQueryData(key, value)
  }, [queryClient, key])

  return { chamber: chamber ?? undefined, loading, setChamber, refetch }
}
