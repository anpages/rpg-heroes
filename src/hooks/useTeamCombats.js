import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const teamCombatsKey = (userId) => ['team-combats', userId]

export function useTeamCombats(userId) {
  const { data: combats = [], isLoading: loading, refetch } = useQuery({
    queryKey: teamCombatsKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_combats')
        .select('*')
        .eq('player_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    enabled:   !!userId,
    staleTime: 30_000,
  })

  return { combats, loading, refetch }
}
