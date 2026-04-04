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

  useEffect(() => {
    fetch()
    if (!heroId) return

    // Realtime: escucha cambios en expeditions del héroe
    const channel = supabase
      .channel(`expeditions:${heroId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expeditions', filter: `hero_id=eq.${heroId}` },
        () => fetch()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [heroId, fetch])

  return { expedition, loading, setExpedition, refetch: fetch }
}
