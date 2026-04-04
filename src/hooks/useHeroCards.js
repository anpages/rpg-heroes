import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useHeroCards(heroId) {
  const [cards, setCards] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!heroId) return Promise.resolve()
    return supabase
      .from('hero_cards')
      .select('*, skill_cards(*)')
      .eq('hero_id', heroId)
      .then(({ data }) => setCards(data ?? []))
  }, [heroId])

  useEffect(() => {
    if (!heroId) return
    supabase
      .from('hero_cards')
      .select('*, skill_cards(*)')
      .eq('hero_id', heroId)
      .then(({ data }) => { setCards(data ?? []); setLoading(false) })
  }, [heroId])

  return { cards, loading, refetch }
}
