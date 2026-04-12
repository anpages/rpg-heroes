import { useState, useEffect } from 'react'
import { useBuildings } from './useBuildings'
import { buildingRateAndCap, PRODUCTION_BUILDING_TYPES } from '../lib/gameConstants'

/**
 * Calcula producción acumulada por edificio en tiempo real (tick cada 10s).
 * Retorna un mapa { gold_mine: { resource, stored, cap, rate, pct, canCollect }, ... }
 */
export function useBuildingProduction(userId) {
  const { buildings, loading } = useBuildings(userId)
  const [production, setProduction] = useState({})

  useEffect(() => {
    function compute() {
      if (!buildings) return
      const result = {}
      const now = Date.now()
      for (const b of buildings) {
        if (!PRODUCTION_BUILDING_TYPES.includes(b.type)) continue
        if (!b.unlocked || b.level <= 0) continue
        const { resource, rate, cap, secondary } = buildingRateAndCap(b.type, b.level)
        const elapsed = Math.max(0, (now - new Date(b.production_collected_at).getTime()) / 3_600_000)
        const stored = Math.min(Math.floor(rate * elapsed), cap)

        let sec = null
        if (secondary) {
          const secStored = Math.min(Math.floor(secondary.rate * elapsed), secondary.cap)
          sec = {
            resource: secondary.resource,
            stored: secStored,
            cap: secondary.cap,
            rate: secondary.rate,
            pct: secondary.cap > 0 ? Math.min(100, Math.round((secStored / secondary.cap) * 100)) : 0,
          }
        }

        result[b.type] = {
          resource,
          stored,
          cap,
          rate,
          pct: cap > 0 ? Math.min(100, Math.round((stored / cap) * 100)) : 0,
          canCollect: stored > 0 || (sec?.stored ?? 0) > 0,
          fullAt: cap > 0 && stored < cap
            ? new Date(new Date(b.production_collected_at).getTime() + (cap / rate) * 3_600_000)
            : null,
          secondary: sec,
        }
      }
      setProduction(result)
    }

    compute()
    const id = setInterval(compute, 10_000)
    return () => clearInterval(id)
  }, [buildings])

  const anyReady = Object.values(production).some(p => p.canCollect)

  return { production, loading, anyReady }
}
