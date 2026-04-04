import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useActiveExpedition(heroId) {
  const [expedition, setExpedition] = useState(undefined)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(() => {
    if (!heroId) return
    supabase
      .from('expeditions')
      .select('*, dungeons(name, duration_minutes, description)')
      .eq('hero_id', heroId)
      .eq('status', 'traveling')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setExpedition(data)
        setLoading(false)
      })
  }, [heroId])

  useEffect(() => { fetch() }, [fetch])

  return { expedition, loading, setExpedition, refetch: fetch }
}
