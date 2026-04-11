import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { apiGet } from '../lib/api'
import { WEEKLY_MODIFIERS, getWeekStart } from '../lib/weeklyModifiers'

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

  // Modificador semanal del héroe: lectura directa de la tabla para evitar el
  // cold-start de la función serverless. Solo cae al endpoint si la fila aún
  // no existe (primera consulta de la semana), que se crea lazy en el backend.
  const { data: weeklyModifier = null, isLoading: weeklyLoading } = useQuery({
    queryKey: queryKeys.weeklyModifier(heroId),
    queryFn: async () => {
      const weekStart = getWeekStart()
      const { data: row } = await supabase
        .from('weekly_dungeon_modifier')
        .select('week_start, hero_id, dungeon_id, modifier_id')
        .eq('week_start', weekStart)
        .eq('hero_id', heroId)
        .maybeSingle()

      if (row) {
        return { ...row, modifier: WEEKLY_MODIFIERS[row.modifier_id] ?? null }
      }

      // No existe aún → fallback a la API para crearla con service role.
      const { weekly } = await apiGet(`/api/weekly-modifier?heroId=${heroId}`)
      return weekly
    },
    enabled: !!heroId,
    staleTime: 60 * 60 * 1000, // 1h: cambia solo al cruzar el lunes UTC
  })

  return { dungeons, loading, weeklyModifier, weeklyLoading }
}
