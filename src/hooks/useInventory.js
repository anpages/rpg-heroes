import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useInventory(heroId) {
  const { data: items = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.inventory(heroId),
    queryFn: async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('*, item_catalog(*), item_runes(slot_index, rune_catalog(id, name, bonuses))')
        .eq('hero_id', heroId)
      return data ?? []
    },
    enabled:   !!heroId,
    staleTime: 30_000,
  })

  return { items, loading: heroId ? loading : false, refetch }
}
