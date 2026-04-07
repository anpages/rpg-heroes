import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useTrainingRooms(userId) {
  const { data: rooms = [], isLoading } = useQuery({
    queryKey: queryKeys.trainingRooms(userId),
    queryFn:  async () => {
      const { data } = await supabase
        .from('training_rooms')
        .select('stat, level, built_at, building_ends_at')
        .eq('player_id', userId)
      return data ?? []
    },
    enabled:   !!userId,
    staleTime: 30_000,
  })

  return { rooms, loading: isLoading }
}
