import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useInventory(heroId) {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    if (!heroId) return
    supabase
      .from('inventory_items')
      .select('*, item_catalog(*)')
      .eq('hero_id', heroId)
      .then(({ data }) => setItems(data ?? []))
  }, [heroId])

  useEffect(() => {
    if (!heroId) return
    supabase
      .from('inventory_items')
      .select('*, item_catalog(*)')
      .eq('hero_id', heroId)
      .then(({ data }) => {
        setItems(data ?? [])
        setLoading(false)
      })
  }, [heroId])

  return { items, loading, refetch }
}
