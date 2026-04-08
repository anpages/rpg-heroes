import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

function interpolate(resources) {
  if (!resources) return null
  const now = Date.now()
  const lastCollected = new Date(resources.last_collected_at).getTime()
  const hoursElapsed = (now - lastCollected) / 3_600_000  // tasas almacenadas en unidades/hora

  return {
    gold:      resources.gold,  // Oro: no tiene producción pasiva, se obtiene en combate
    iron:      Math.floor(resources.iron + resources.iron_rate * hoursElapsed),
    wood:      Math.floor(resources.wood + resources.wood_rate * hoursElapsed),
    mana:      Math.floor(resources.mana + resources.mana_rate * hoursElapsed),
    fragments: resources.fragments ?? 0,  // No tienen producción pasiva, solo drops
    essence:   resources.essence   ?? 0,
    gold_rate: 0,
    iron_rate: resources.iron_rate,
    wood_rate: resources.wood_rate,
    mana_rate: resources.mana_rate,
  }
}

export function useResources(userId) {
  const [resources, setResources] = useState(null)
  const baseRef = useRef(null)
  const key = queryKeys.resources(userId)

  // Fetch con caché + polling de seguridad cada 60s.
  // Las mutaciones que cambian recursos ya invalidan explícitamente esta query,
  // así que el refetch periódico es solo red de seguridad (múltiples tabs, etc.)
  const { data: baseData, isLoading: loading, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase
        .from('resources')
        .select('gold, iron, wood, mana, fragments, essence, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
        .eq('player_id', userId)
        .single()
      return data
    },
    enabled:         !!userId,
    staleTime:       55_000,
    refetchInterval: 60_000,
  })

  // Cuando el servidor devuelve datos, actualizar ref + estado interpolado
  useEffect(() => {
    if (baseData) {
      baseRef.current = baseData
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResources(interpolate(baseData))
    }
  }, [baseData])

  // Ticker de 1s: interpolación client-side desde el base en ref
  useEffect(() => {
    const interval = setInterval(() => {
      if (baseRef.current) setResources(interpolate(baseRef.current))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return { resources, loading, refetch }
}
