import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useRanking() {
  const { data: ranking = null, isLoading: loading } = useQuery({
    queryKey: queryKeys.ranking(),
    queryFn: async () => {
      const { data } = await supabase
        .from('heroes')
        .select('level, class, name, player_id, players(username), classes(name, color, bg_color, border_color)')
        .order('level', { ascending: false })
        .limit(100)
      return data ?? []
    },
    staleTime: 60_000, // el ranking cambia lentamente
  })

  return { ranking, loading }
}
