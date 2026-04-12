import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useHero(heroId) {
  const { data: hero = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.hero(heroId),
    queryFn: async () => {
      const { data } = await supabase
        .from('heroes')
        .select('*, classes(*), expeditions(ends_at, status)')
        .eq('id', heroId)
        .single()
      return data ?? null
    },
    enabled:   !!heroId,
    staleTime: 30_000,
  })

  return { hero, loading: heroId ? loading : false, refetch }
}
