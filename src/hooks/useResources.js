import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

/**
 * Hook de recursos. Sin interpolación pasiva — la producción idle
 * se acumula en edificios y se recolecta manualmente.
 */
export function useResources(userId) {
  const { data: resources = null, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.resources(userId),
    queryFn: async () => {
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('player_id', userId)
        .single()
      if (!data) return null
      return {
        gold:        data.gold,
        iron:        Math.floor(data.iron),
        wood:        Math.floor(data.wood),
        mana:        Math.floor(data.mana),
        fragments:   data.fragments   ?? 0,
        essence:     data.essence     ?? 0,
        coal:        data.coal        ?? 0,
        fiber:       data.fiber       ?? 0,
        arcane_dust: data.arcane_dust ?? 0,
        herbs:       data.herbs       ?? 0,
        flowers:     data.flowers     ?? 0,
        bag_extra_slots: data.bag_extra_slots ?? 0,
        lab_inventory_upgrades: data.lab_inventory_upgrades ?? 0,
      }
    },
    enabled:         !!userId,
  })

  return { resources, loading, refetch }
}
