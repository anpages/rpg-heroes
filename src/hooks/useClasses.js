import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useClasses() {
  const [classes, setClasses] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('classes')
      .select('*')
      .order('id')
      .then(({ data }) => {
        setClasses(data)
        setLoading(false)
      })
  }, [])

  return { classes, loading }
}
