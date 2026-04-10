import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useHeroRunes(heroId) {
  const { data, ...rest } = useQuery({
    queryKey: queryKeys.heroRunes(heroId),
    queryFn:  async () => {
      const [catalogRes, inventoryRes, craftingRes] = await Promise.all([
        supabase.from('rune_catalog').select('*').order('min_lab_level'),
        supabase.from('hero_runes').select('rune_id, quantity, rune_catalog(*)').eq('hero_id', heroId),
        supabase.from('rune_crafting').select('rune_id, craft_ends_at').eq('hero_id', heroId),
      ])
      const craftingMap = Object.fromEntries((craftingRes.data ?? []).map(c => [c.rune_id, c]))
      return {
        catalog:     catalogRes.data   ?? [],
        inventory:   inventoryRes.data ?? [],
        craftingMap,
      }
    },
    enabled:  !!heroId,
    staleTime: 30_000,
  })

  return {
    catalog:     data?.catalog     ?? [],
    inventory:   data?.inventory   ?? [],
    craftingMap: data?.craftingMap ?? {},
    ...rest,
  }
}
