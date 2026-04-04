import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useHero(heroId) {
  const [hero, setHero]       = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!heroId) return
    const { data } = await supabase
      .from('heroes')
      .select('*, classes(*)')
      .eq('id', heroId)
      .single()
    setHero(data ?? null)
  }, [heroId])

  useEffect(() => {
    if (!heroId) return
    supabase
      .from('heroes')
      .select('*, classes(*)')
      .eq('id', heroId)
      .single()
      .then(({ data }) => {
        setHero(data ?? null)
        setLoading(false)
      })
  }, [heroId])

  return { hero, loading, refetch }
}
