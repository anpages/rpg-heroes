import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function usePotions(heroId) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.potions(heroId),
    queryFn:  async () => {
      const [{ data: inventory }, { data: catalog }, { data: crafting }] = await Promise.all([
        supabase
          .from('hero_potions')
          .select('potion_id, quantity')
          .eq('hero_id', heroId),
        supabase
          .from('potion_catalog')
          .select('*')
          .order('min_lab_level'),
        supabase
          .from('potion_crafting')
          .select('potion_id, craft_ends_at')
          .eq('hero_id', heroId)
          .single(),
      ])
      const stockById = Object.fromEntries((inventory ?? []).map(r => [r.potion_id, r.quantity]))
      const potions = (catalog ?? []).map(p => ({ ...p, quantity: stockById[p.id] ?? 0 }))
      return { potions, crafting: crafting ?? null }
    },
    enabled:   !!heroId,
    staleTime: 30_000,
  })

  return {
    potions:  data?.potions  ?? [],
    crafting: data?.crafting ?? null,
    loading:  heroId ? isLoading : false,
  }
}
