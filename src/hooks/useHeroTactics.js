import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useHeroTactics(heroId) {
  const { data: tactics = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.heroTactics(heroId),
    queryFn: async () => {
      const { data } = await supabase
        .from('hero_tactics')
        .select('*, tactic_catalog(*)')
        .eq('hero_id', heroId)
        .order('slot_index', { ascending: true, nullsFirst: false })
      return data ?? []
    },
    enabled: !!heroId,
    staleTime: 30_000,
  })
  return { tactics, loading: heroId ? loading : false, refetch }
}
