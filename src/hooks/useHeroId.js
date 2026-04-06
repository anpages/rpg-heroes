import { useAppStore } from '../store/appStore'
import { useHeroes } from './useHeroes'

/**
 * Devuelve el heroId activo:
 * - Si el usuario ha seleccionado uno explícitamente → ese
 * - Si no → el primero de la lista (heroes[0].id)
 * - Si no hay héroes → null
 */
export function useHeroId() {
  const userId         = useAppStore(s => s.userId)
  const selectedHeroId = useAppStore(s => s.selectedHeroId)
  const { heroes }     = useHeroes(userId)
  return selectedHeroId ?? heroes?.[0]?.id ?? null
}
