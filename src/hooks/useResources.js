import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

function interpolate(resources) {
  if (!resources) return null
  const now = Date.now()
  const lastCollected = new Date(resources.last_collected_at).getTime()
  const minutesElapsed = (now - lastCollected) / 60000

  return {
    gold:      Math.floor(resources.gold + resources.gold_rate * minutesElapsed),
    wood:      Math.floor(resources.wood + resources.wood_rate * minutesElapsed),
    mana:      Math.floor(resources.mana + resources.mana_rate * minutesElapsed),
    gold_rate: resources.gold_rate,
    wood_rate: resources.wood_rate,
    mana_rate: resources.mana_rate,
  }
}

export function useResources(userId) {
  const [resources, setResources] = useState(null)
  const baseRef = useRef(null)
  const key = queryKeys.resources(userId)

  // Fetch con caché + polling de respaldo cada 30s
  const { data: baseData, isLoading: loading, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('player_id', userId)
        .single()
      return data
    },
    enabled:         !!userId,
    staleTime:       25_000,
    refetchInterval: 30_000,
  })

  // Cuando el servidor devuelve datos, actualizar ref + estado interpolado
  useEffect(() => {
    if (baseData) {
      baseRef.current = baseData
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
