import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useRanking() {
  const { data: ranking = null, isLoading: loading } = useQuery({
    queryKey: queryKeys.ranking(),
    queryFn: async () => {
      const { data } = await supabase
        .from('heroes')
        .select('id, level, class, name, player_id, combats_played, combats_won, tower_progress(max_floor)')
        .order('level', { ascending: false })
        .order('combats_won', { ascending: false })
        .limit(100)
      return data ?? []
    },
    staleTime: 60_000,
  })

  return { ranking, loading }
}
