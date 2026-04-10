import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useHeroes(userId) {
  const { data: heroes = [], isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.heroes(userId),
    queryFn: async () => {
      const { data } = await supabase
        .from('heroes')
        .select('*, classes(*), expeditions(ends_at, status), chamber_runs(ends_at, status)')
        .eq('player_id', userId)
        .order('slot')
      return data ?? []
    },
    enabled:   !!userId,
    staleTime: 30_000,
  })

  return { heroes, loading, refetch }
}
