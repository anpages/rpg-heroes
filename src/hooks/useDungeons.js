import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { apiGet } from '../lib/api'

export function useDungeons(heroId = null) {
  const { data: dungeons = null, isLoading: loading } = useQuery({
    queryKey: queryKeys.dungeons(),
    queryFn: async () => {
      const { data } = await supabase
        .from('dungeons')
        .select('*')
        .order('difficulty')
      return data ?? []
    },
    staleTime: Infinity, // Los datos de mazmorras no cambian en runtime
  })

  // Modificador semanal del héroe: cada héroe tiene su propio desafío,
  // filtrado por su nivel. El endpoint dispara la creación lazy si no existe.
  const { data: weeklyModifier = null, isLoading: weeklyLoading } = useQuery({
    queryKey: queryKeys.weeklyModifier(heroId),
    queryFn: async () => {
      const { weekly } = await apiGet(`/api/weekly-modifier?heroId=${heroId}`)
      return weekly
    },
    enabled: !!heroId,
    staleTime: 60 * 60 * 1000, // 1h: cambia solo al cruzar el lunes UTC
  })

  return { dungeons, loading, weeklyModifier, weeklyLoading }
}
