import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useMissions() {
  const [missions, setMissions]           = useState(null)
  const [secondsToReset, setSecondsToReset] = useState(null)
  const [loading, setLoading]             = useState(true)

  const fetch = useCallback(async () => {
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await window.fetch('/api/missions-get', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return
    const data = await res.json()
    setMissions(data.missions ?? [])
    setSecondsToReset(data.secondsToReset)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { missions, secondsToReset, loading, refetch: fetch }
}
