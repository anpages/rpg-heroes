import { useState, useEffect } from 'react'
import { useBuildings } from './useBuildings'
import { buildingRate, PRODUCTION_BUILDING_TYPES } from '../lib/gameConstants'

/**
 * Calcula producción acumulada por edificio en tiempo real (tick cada 2s).
 * Retorna un mapa { gold_mine: { resource, stored, rate, cap, canCollect, fillPct, secondsToFull }, ... }
 *
 * La barra de progreso ahora es de capacidad: stored/cap (0-100%).
 * Al llenarse (100%), el edificio deja de producir — el jugador pierde producción si no recoge.
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
        const { resource, rate, cap } = buildingRate(b.type, b.level)
        const elapsed = Math.max(0, (now - new Date(b.production_collected_at).getTime()) / 3_600_000)
        const produced = Math.min(cap, rate * elapsed)
        const stored = Math.floor(produced)
        const fillPct = cap > 0 ? Math.min(100, (produced / cap) * 100) : 0
        const isFull = produced >= cap
        const secondsToFull = isFull ? 0 : Math.max(0, Math.ceil(((cap - produced) / rate) * 3600))

        result[b.type] = {
          resource,
          stored,
          rate,
          cap,
          fillPct,
          isFull,
          secondsToFull,
          canCollect: isFull,
        }
      }
      setProduction(result)
    }

    compute()
    const id = setInterval(compute, 2_000)
    return () => clearInterval(id)
  }, [buildings])

  const anyReady = Object.values(production).some(p => p.canCollect)

  return { production, loading, anyReady }
}
