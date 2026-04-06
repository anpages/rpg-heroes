import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useDungeons() {
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

  return { dungeons, loading }
}
