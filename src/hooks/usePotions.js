import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function usePotions(userId) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.potions(userId),
    queryFn:  async () => {
      const [{ data: inventory }, { data: catalog }, { data: crafting }] = await Promise.all([
        supabase
          .from('player_potions')
          .select('potion_id, quantity')
          .eq('player_id', userId),
        supabase
          .from('potion_catalog')
          .select('*')
          .order('min_lab_level'),
        supabase
          .from('player_potion_crafting')
          .select('id, potion_id, craft_ends_at')
          .eq('player_id', userId)
          .order('craft_ends_at', { ascending: true }),
      ])
      const stockById = Object.fromEntries((inventory ?? []).map(r => [r.potion_id, r.quantity]))
      const potions = (catalog ?? []).map(p => ({ ...p, quantity: stockById[p.id] ?? 0 }))
      // Agrupa por potion_id para que cada receta pueda tener varios crafts simultáneos.
      const craftingMap = {}
      for (const c of crafting ?? []) {
        (craftingMap[c.potion_id] ??= []).push(c)
      }
      return { potions, craftingMap }
    },
    enabled:   !!userId,
    staleTime: 30_000,
  })

  return {
    potions:     data?.potions     ?? [],
    craftingMap: data?.craftingMap ?? {},
    loading:     userId ? isLoading : false,
  }
}
