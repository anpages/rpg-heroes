import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useTowerProgress(heroId) {
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.towerProgress(heroId),
    queryFn: async () => {
      const [progressRes, attemptsRes] = await Promise.all([
        supabase
          .from('tower_progress')
          .select('max_floor')
          .eq('hero_id', heroId)
          .maybeSingle(),
        supabase
          .from('tower_attempts')
          .select('floor')
          .eq('hero_id', heroId),
      ])
      const maxFloor = progressRes.data?.max_floor ?? 0
      // Contar intentos por piso
      const attemptsByFloor = {}
      for (const a of attemptsRes.data ?? []) {
        attemptsByFloor[a.floor] = (attemptsByFloor[a.floor] ?? 0) + 1
      }
      return { maxFloor, attemptsByFloor }
    },
    enabled:   !!heroId,
    staleTime: 30_000,
  })

  return {
    maxFloor:        data?.maxFloor ?? 0,
    attemptsByFloor: data?.attemptsByFloor ?? {},
    loading,
    refetch,
  }
}
