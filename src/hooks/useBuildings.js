import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useBuildings(userId) {
  const [buildings, setBuildings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    supabase
      .from('buildings')
      .select('*')
      .eq('player_id', userId)
      .then(({ data }) => {
        setBuildings(data)
        setLoading(false)
      })
  }, [userId])

  return { buildings, loading, setBuildings }
}
