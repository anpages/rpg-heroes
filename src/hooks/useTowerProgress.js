import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useTowerProgress(heroId) {
  const [maxFloor, setMaxFloor] = useState(null)
  const [loading, setLoading]   = useState(true)

  async function fetch() {
    if (!heroId) return
    const { data } = await supabase
      .from('tower_progress')
      .select('max_floor')
      .eq('hero_id', heroId)
      .maybeSingle()
    setMaxFloor(data?.max_floor ?? 0)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [heroId])

  return { maxFloor, loading, refetch: fetch }
}
