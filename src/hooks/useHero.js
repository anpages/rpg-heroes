import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useHero(userId) {
  const [hero, setHero] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    // Carga inicial
    supabase
      .from('heroes')
      .select('*, classes(*)')
      .eq('player_id', userId)
      .single()
      .then(({ data }) => {
        setHero(data)
        setLoading(false)
      })

    // Realtime: escucha cambios en el héroe
    const channel = supabase
      .channel(`heroes:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'heroes', filter: `player_id=eq.${userId}` },
        async ({ new: newData }) => {
          // Refetch completo para incluir el join con classes
          const { data } = await supabase
            .from('heroes')
            .select('*, classes(*)')
            .eq('player_id', userId)
            .single()
          setHero(data)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId])

  return { hero, loading }
}
