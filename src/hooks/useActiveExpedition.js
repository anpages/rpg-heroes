import { useEffect, useCallback } from 'react'
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

  // Realtime: trigger refetch en cualquier cambio de expedición del héroe
  useEffect(() => {
    if (!heroId) return
    const channel = supabase
      .channel(`expeditions:${heroId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expeditions', filter: `hero_id=eq.${heroId}` },
        () => refetch()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [heroId, refetch])

  // Para optimistic updates: sobreescribe la caché sin esperar al servidor
  const setExpedition = useCallback((value) => {
    queryClient.setQueryData(key, value)
  }, [queryClient, key]) // eslint-disable-line

  return { expedition: expedition ?? undefined, loading, setExpedition, refetch }
}
