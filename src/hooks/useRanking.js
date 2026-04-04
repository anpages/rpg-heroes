import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useRanking() {
  const [ranking, setRanking] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('heroes')
      .select('level, class, name, player_id, players(username), classes(name, color, bg_color, border_color)')
      .order('level', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRanking(data)
        setLoading(false)
      })
  }, [])

  return { ranking, loading }
}
