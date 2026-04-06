import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

export function useClasses() {
  const { data: classes = null, isLoading: loading } = useQuery({
    queryKey: queryKeys.classes(),
    queryFn: async () => {
      const { data } = await supabase
        .from('classes')
        .select('*')
        .order('id')
      return data ?? []
    },
    staleTime: Infinity, // las clases nunca cambian en runtime
  })

  return { classes, loading }
}
