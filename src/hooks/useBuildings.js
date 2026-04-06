import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useBuildings(userId) {
  const { data: buildings = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.buildings(userId),
    queryFn: async () => {
      const { data } = await supabase
        .from('buildings')
        .select('*')
        .eq('player_id', userId)
      return data ?? []
    },
    enabled:   !!userId,
    staleTime: 30_000,
  })

  return { buildings, loading, refetch }
}
