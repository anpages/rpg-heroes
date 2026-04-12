import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useTrainingTokens(userId) {
  const { data: tokens = {}, isLoading } = useQuery({
    queryKey: queryKeys.trainingTokens(userId),
    queryFn: async () => {
      const { data } = await supabase
        .from('player_training_tokens')
        .select('stat, quantity')
        .eq('player_id', userId)
      return Object.fromEntries((data ?? []).map(r => [r.stat, r.quantity]))
    },
    enabled:   !!userId,
    staleTime: 30_000,
  })

  const totalTokens = Object.values(tokens).reduce((s, q) => s + q, 0)

  return { tokens, totalTokens, loading: userId ? isLoading : false }
}
