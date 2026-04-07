import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { apiGet } from '../lib/api'

/**
 * Devuelve el catálogo completo de runas + el inventario de runas craftadas del héroe.
 * catalog: todas las runas disponibles (seed estático de la DB)
 * inventory: runas craftadas por el héroe aún no incrustadas (quantity > 0)
 */
export function useHeroRunes(heroId) {
  const { data, ...rest } = useQuery({
    queryKey: queryKeys.heroRunes(heroId),
    queryFn:  () => apiGet(`/api/hero-runes?heroId=${heroId}`),
    enabled:  !!heroId,
    staleTime: 30_000,
  })

  return {
    catalog:   data?.catalog   ?? [],
    inventory: data?.inventory ?? [],
    ...rest,
  }
}
