import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDungeons() {
  const [dungeons, setDungeons] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('dungeons')
      .select('*')
      .order('difficulty')
      .then(({ data }) => {
        setDungeons(data)
        setLoading(false)
      })
  }, [])

  return { dungeons, loading }
}
