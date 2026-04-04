import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useHero(userId) {
  const [hero, setHero] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    supabase
      .from('heroes')
      .select('*')
      .eq('player_id', userId)
      .single()
      .then(({ data }) => {
        setHero(data)
        setLoading(false)
      })
  }, [userId])

  return { hero, loading }
}
