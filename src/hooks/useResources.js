import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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
  const baseRef = useRef(null)

  useEffect(() => {
    if (!userId) return

    // Carga inicial
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

    // Realtime: escucha cambios en resources
    const channel = supabase
      .channel(`resources:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources', filter: `player_id=eq.${userId}` },
        ({ new: newData }) => {
          baseRef.current = newData
          setResources(interpolate(newData))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId])

  // Ticker cada segundo para la interpolación
  useEffect(() => {
    const interval = setInterval(() => {
      if (baseRef.current) setResources(interpolate(baseRef.current))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Polling de respaldo cada 30s por si Realtime no está habilitado
  useEffect(() => {
    if (!userId) return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('player_id', userId)
        .single()
      if (data) {
        baseRef.current = data
        setResources(interpolate(data))
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [userId])

  async function refetch() {
    if (!userId) return
    const { data } = await supabase
      .from('resources')
      .select('*')
      .eq('player_id', userId)
      .single()
    if (data) {
      baseRef.current = data
      setResources(interpolate(data))
    }
  }

  return { resources, loading, refetch }
}
