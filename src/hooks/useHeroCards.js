import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useHeroCards(heroId) {
  const { data: cards = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.heroCards(heroId),
    queryFn: async () => {
      const { data } = await supabase
        .from('hero_cards')
        .select('*, skill_cards(*)')
        .eq('hero_id', heroId)
      return data ?? []
    },
    enabled:   !!heroId,
    staleTime: 30_000,
  })

  return { cards, loading: heroId ? loading : false, refetch }
}
