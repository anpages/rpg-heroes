import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useHero(userId) {
  const [hero, setHero] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!userId) return
    supabase
      .from('heroes')
      .select('*, classes(*)')
      .eq('player_id', userId)
      .single()
      .then(({ data }) => setHero(data))
  }, [userId])

  useEffect(() => {
    if (!userId) return

    supabase
      .from('heroes')
      .select('*, classes(*)')
      .eq('player_id', userId)
      .single()
      .then(({ data }) => {
        setHero(data)
        setLoading(false)
      })
  }, [userId])

  return { hero, loading, refetch }
}
