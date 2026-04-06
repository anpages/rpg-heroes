import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useTowerProgress(heroId) {
  const { data: maxFloor = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.towerProgress(heroId),
    queryFn: async () => {
      const { data } = await supabase
        .from('tower_progress')
        .select('max_floor')
        .eq('hero_id', heroId)
        .maybeSingle()
      return data?.max_floor ?? 0
    },
    enabled:   !!heroId,
    staleTime: 30_000,
  })

  return { maxFloor, loading, refetch }
}
