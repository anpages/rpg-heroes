import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useHeroes(userId) {
  const [heroes, setHeroes]   = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('heroes')
      .select('*, classes(*), expeditions(ends_at, status)')
      .eq('player_id', userId)
      .order('slot')
    setHeroes(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { refetch() }, [refetch])

  return { heroes, loading, refetch }
}
