import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Calcula los recursos actuales interpolando desde last_collected_at
function interpolate(resources) {
  if (!resources) return null
  const now = Date.now()
  const lastCollected = new Date(resources.last_collected_at).getTime()
  const minutesElapsed = (now - lastCollected) / 60000

  return {
    gold: Math.floor(resources.gold + resources.gold_rate * minutesElapsed),
    wood: Math.floor(resources.wood + resources.wood_rate * minutesElapsed),
    mana: Math.floor(resources.mana + resources.mana_rate * minutesElapsed),
    gold_rate: resources.gold_rate,
    wood_rate: resources.wood_rate,
    mana_rate: resources.mana_rate,
  }
}

export function useResources(userId) {
  const [resources, setResources] = useState(null)
  const [loading, setLoading] = useState(true)
  const baseRef = useRef(null) // datos en bruto de la BD

  // Carga inicial
  useEffect(() => {
    if (!userId) return

    supabase
      .from('resources')
      .select('*')
      .eq('player_id', userId)
      .single()
      .then(({ data }) => {
        baseRef.current = data
        setResources(interpolate(data))
        setLoading(false)
      })
  }, [userId])

  // Ticker: actualiza los recursos cada segundo sin volver a la BD
  useEffect(() => {
    const interval = setInterval(() => {
      if (baseRef.current) {
        setResources(interpolate(baseRef.current))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return { resources, loading }
}
