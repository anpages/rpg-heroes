import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'

/**
 * Mutation keys usadas por Base.jsx.
 * Mientras haya mutaciones pendientes con estas keys, Realtime no invalida
 * los queries afectados — el onSettled de la última mutación reconcilia.
 */
const COLLECT_KEY          = ['building-collect']
const REFINE_KEY           = ['refining-start']
const TACTIC_KEY           = ['tactic-equip']
const TACTIC_LEVELUP_KEY   = ['tactic-levelup']
const TRAINING_COLL_KEY    = ['training-collect']
const TRAINING_BUILD_KEY   = ['training-build-collect']
const TRAINING_ASSIGN_KEY  = ['training-assign']
const STRATEGY_KEY         = ['strategy']
const EQUIP_KEY            = ['equip']
const REPAIR_KEY           = ['repair']
const DISMANTLE_KEY        = ['dismantle']
const ENCHANT_KEY          = ['enchant']

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

    // Helpers: solo invalidar si no hay mutaciones en vuelo que afecten estos datos
    const noCollect   = () => qc.isMutating({ mutationKey: COLLECT_KEY })   === 0
    const noRefine    = () => qc.isMutating({ mutationKey: REFINE_KEY })    === 0
    const noRepair    = () => qc.isMutating({ mutationKey: REPAIR_KEY })    === 0
    const noDismantle = () => qc.isMutating({ mutationKey: DISMANTLE_KEY }) === 0
    const safeInvalidateBuildings  = () => { if (noCollect()) qc.invalidateQueries({ queryKey: queryKeys.buildings(userId) }) }
    const safeInvalidateResources  = () => { if (noCollect() && noRefine() && noRepair() && noDismantle()) qc.invalidateQueries({ queryKey: queryKeys.resources(userId) }) }
    const noLevelup = () => qc.isMutating({ mutationKey: TACTIC_LEVELUP_KEY }) === 0
    const safeInvalidateCrafted    = () => { if (noRefine() && noLevelup()) qc.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) }) }

    const channel = supabase
      .channel(`user:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources',               filter: `player_id=eq.${userId}` }, safeInvalidateResources)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings',               filter: `player_id=eq.${userId}` }, safeInvalidateBuildings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_crafted_items',    filter: `player_id=eq.${userId}` }, safeInvalidateCrafted)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_refining_slots',   filter: `player_id=eq.${userId}` }, safeInvalidateCrafted)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_research',         filter: `player_id=eq.${userId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.research(userId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_rooms',          filter: `player_id=eq.${userId}` }, () => { if (qc.isMutating({ mutationKey: TRAINING_BUILD_KEY }) === 0) qc.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_training_tokens',  filter: `player_id=eq.${userId}` }, () => { if (qc.isMutating({ mutationKey: TRAINING_COLL_KEY }) === 0 && qc.isMutating({ mutationKey: TRAINING_ASSIGN_KEY }) === 0) qc.invalidateQueries({ queryKey: queryKeys.trainingTokens(userId) }) })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && initializedRef.current.user) {
          // Reconexión: invalidar todo para ponerse al día (respetando mutaciones en vuelo)
          safeInvalidateResources()
          safeInvalidateBuildings()
          safeInvalidateCrafted()
          qc.invalidateQueries({ queryKey: queryKeys.research(userId) })
          qc.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) })
          qc.invalidateQueries({ queryKey: queryKeys.trainingTokens(userId) })
        }
        if (status === 'SUBSCRIBED') initializedRef.current.user = true
      })

    const initRef = initializedRef.current
    return () => {
      initRef.user = false
      supabase.removeChannel(channel)
    }
  }, [userId, qc])

  // ── Canal hero-scoped (filtrado por hero_id) ────────────────────────────────
  useEffect(() => {
    if (!heroId) return

    const channel = supabase
      .channel(`hero:${heroId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'heroes',          filter: `id=eq.${heroId}` },      () => { if (qc.isMutating({ mutationKey: TRAINING_ASSIGN_KEY }) === 0 && qc.isMutating({ mutationKey: ['class-training', heroId] }) === 0 && qc.isMutating({ mutationKey: STRATEGY_KEY }) === 0) { qc.invalidateQueries({ queryKey: queryKeys.hero(heroId) }); qc.invalidateQueries({ queryKey: queryKeys.heroes(userId) }) } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_training',   filter: `hero_id=eq.${heroId}` }, () => { if (qc.isMutating({ mutationKey: TRAINING_COLL_KEY }) === 0) qc.invalidateQueries({ queryKey: queryKeys.training(heroId) }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `hero_id=eq.${heroId}` }, () => {
        const noPending = qc.isMutating({ mutationKey: EQUIP_KEY })    === 0
                       && qc.isMutating({ mutationKey: REPAIR_KEY })   === 0
                       && qc.isMutating({ mutationKey: DISMANTLE_KEY }) === 0
                       && qc.isMutating({ mutationKey: ENCHANT_KEY })  === 0
        if (noPending) qc.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expeditions',     filter: `hero_id=eq.${heroId}` }, () => qc.invalidateQueries({ queryKey: queryKeys.activeExpedition(heroId) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hero_tactics',   filter: `hero_id=eq.${heroId}` }, () => { if (qc.isMutating({ mutationKey: TACTIC_KEY }) === 0 && qc.isMutating({ mutationKey: TACTIC_LEVELUP_KEY }) === 0) qc.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) }) })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && initializedRef.current.hero) {
          qc.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
          qc.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
          qc.invalidateQueries({ queryKey: queryKeys.training(heroId) })
          qc.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
          qc.invalidateQueries({ queryKey: queryKeys.activeExpedition(heroId) })
          if (qc.isMutating({ mutationKey: TACTIC_KEY }) === 0) qc.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) })
        }
        if (status === 'SUBSCRIBED') initializedRef.current.hero = true
      })

    const initRef = initializedRef.current
    return () => {
      initRef.hero = false
      supabase.removeChannel(channel)
    }
  }, [heroId, userId, qc])
}
