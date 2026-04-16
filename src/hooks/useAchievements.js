import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '../store/appStore'
import { apiGet } from '../lib/api'
import { queryKeys } from '../lib/queryKeys'

export function useAchievements() {
  const userId = useAppStore(s => s.userId)

  const { data, isLoading: loading } = useQuery({
    queryKey: queryKeys.achievements(userId),
    queryFn:  () => apiGet('/api/achievements'),
    staleTime: 30_000,
    enabled: !!userId,
  })

  return { achievements: data?.achievements ?? null, loading }
}
