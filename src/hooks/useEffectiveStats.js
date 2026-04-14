import { useMemo } from 'react'
import { useHero } from './useHero'
import { useInventory } from './useInventory'
import { useHeroTactics } from './useHeroTactics'
import { useResearch } from './useResearch'
import { computeEffectiveStats } from '../lib/gameFormulas'
import { computeResearchBonuses } from '../lib/gameConstants'

/**
 * Stats efectivas del héroe — misma lógica que api/_stats.js.
 * Fuente de verdad única para el frontend: Hero.jsx, Equipo.jsx, etc.
 */
export function useEffectiveStats(heroId, userId) {
  const { hero }    = useHero(heroId)
  const { items }   = useInventory(heroId)
  const { tactics } = useHeroTactics(heroId)
  const { research } = useResearch(userId)

  const stats = useMemo(() => {
    if (!hero) return null
    const rb = computeResearchBonuses(research?.completed ?? [])
    return computeEffectiveStats(hero, items ?? [], tactics ?? [], rb)
  }, [hero, items, tactics, research])

  return { stats, hero, items, tactics }
}
