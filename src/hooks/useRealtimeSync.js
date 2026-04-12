import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

/**
 * Mutation key usada por collectMutation / _collectAllMutation en Base.jsx.
 * Mientras haya mutaciones pendientes con esta key, Realtime no invalida
 * buildings ni resources — el onSettled de la última mutación reconcilia.
 */
const COLLECT_KEY = ['building-collect']

/**
 * Hook centralizado de Supabase Realtime.
 *
 * Crea 2 canales (user-scoped y hero-scoped) que escuchan postgres_changes
 * e invalidan el cache de React Query cuando el servidor escribe.
 * Reemplaza todo el polling (refetchInterval) y la suscripción individual
 * de useActiveExpedition.
 *
 * Protección anti-flicker: durante recolecciones en vuelo, las invalidaciones
 * de buildings y resources se posponen para no sobreescribir optimistic updates.
 */
export function useRealtimeSync(userId, heroId) {
  const qc = useQueryClient()
  const initializedRef = useRef({ user: false, hero: false })

  // ── Canal user-scoped (filtrado por player_id) ──────────────────────────────
  useEffect(() => {
    if (!userId) return

    // Helpers: solo invalidar si no hay recolecciones en vuelo
    const safeInvalidateBuildings  = () => { if (qc.isMutating({ mutationKey: COLLECT_KEY }) === 0) qc.invalidateQueries({ queryKey: queryKeys.buildings(userId) }) }
    const safeInvalidateResources  = () => { if (qc.isMutating({ mutationKey: COLLECT_KEY }) === 0) qc.invalidateQueries({ queryKey: queryKeys.resources(userId) }) }

    const channel = supabase
      .channel(`user:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources',               filter: `player_id=eq.${userId}` }, safeInvalidateResources)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings',               filter: `player_id=eq.${userId}` }, safeInvalidateBuildings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_crafting_queue',   filter: `player_id=eq.${userId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_potion_crafting',  filter: `player_id=eq.${userId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.potions(userId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_potions',          filter: `player_id=eq.${userId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.potions(userId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_research',         filter: `player_id=eq.${userId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.research(userId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_rooms',          filter: `player_id=eq.${userId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_training_tokens',  filter: `player_id=eq.${userId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.trainingTokens(userId) }))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && initializedRef.current.user) {
          // Reconexión: invalidar todo para ponerse al día (respetando mutaciones en vuelo)
          safeInvalidateResources()
          safeInvalidateBuildings()
          qc.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) })
          qc.invalidateQueries({ queryKey: queryKeys.potions(userId) })
          qc.invalidateQueries({ queryKey: queryKeys.research(userId) })
          qc.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) })
          qc.invalidateQueries({ queryKey: queryKeys.trainingTokens(userId) })
        }
        if (status === 'SUBSCRIBED') initializedRef.current.user = true
      })

    return () => {
      initializedRef.current.user = false
      supabase.removeChannel(channel)
    }
  }, [userId, qc])

  // ── Canal hero-scoped (filtrado por hero_id) ────────────────────────────────
  useEffect(() => {
    if (!heroId) return

    const channel = supabase
      .channel(`hero:${heroId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'heroes',          filter: `id=eq.${heroId}` },      () => { qc.invalidateQueries({ queryKey: queryKeys.hero(heroId) }); qc.invalidateQueries({ queryKey: queryKeys.heroes(userId) }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_training',   filter: `hero_id=eq.${heroId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.training(heroId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `hero_id=eq.${heroId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.inventory(heroId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expeditions',     filter: `hero_id=eq.${heroId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.activeExpedition(heroId) }))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && initializedRef.current.hero) {
          qc.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
          qc.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
          qc.invalidateQueries({ queryKey: queryKeys.training(heroId) })
          qc.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
          qc.invalidateQueries({ queryKey: queryKeys.activeExpedition(heroId) })
        }
        if (status === 'SUBSCRIBED') initializedRef.current.hero = true
      })

    return () => {
      initializedRef.current.hero = false
      supabase.removeChannel(channel)
    }
  }, [heroId, userId, qc])
}
