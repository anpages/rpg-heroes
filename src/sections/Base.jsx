import { useState, useEffect, useReducer } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import { useBuildings } from '../hooks/useBuildings'
import { useResources } from '../hooks/useResources'
import { useBuildingProduction } from '../hooks/useBuildingProduction'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { useResearch } from '../hooks/useResearch'
import { REFINING_BUILDING_TYPES, buildingRate, PRODUCTION_BUILDING_TYPES } from '../lib/gameConstants'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import BaseHeader from './base/BaseHeader.jsx'
import ZonePills from './base/ZonePills.jsx'
import RecursosZone from './base/RecursosZone.jsx'
import RefinadoZone from './base/RefinadoZone.jsx'
import TallerZone from './base/TallerZone.jsx'
import BibliotecaZone from './base/BibliotecaZone.jsx'

export default function Base({ mainRef }) {
  const userId      = useAppStore(s => s.userId)
  const activeTab   = useAppStore(s => s.activeTab)
  const queryClient = useQueryClient()
  const { buildings, loading } = useBuildings(userId)
  const { resources }          = useResources(userId)
  const { production, anyReady } = useBuildingProduction(userId)
  const { catalog, inventory, refiningSlots } = useCraftedItems(userId)
  const { research } = useResearch(userId)
  const [activeZone,    setActiveZone]    = useState('produccion')
  const [resourceDelta, setResourceDelta] = useState({ iron: 0, wood: 0, mana: 0 })
  const [upgradePending, setUpgradePending] = useState(false)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  // Al volver a la Base, resetear a Producción
  useEffect(() => {
    if (activeTab === 'base') setActiveZone('produccion')
  }, [activeTab])

  useEffect(() => {
    if (mainRef?.current) mainRef.current.scrollTop = 0
  }, [activeZone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(forceUpdate, 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Helpers: optimistic cache ────────────────────────────────────────────────
  const RESOURCE_NAMES = {
    iron: 'hierro', wood: 'madera', mana: 'maná', herbs: 'hierbas',
  }

  const bKey = queryKeys.buildings(userId)
  const rKey = queryKeys.resources(userId)
  const cKey = queryKeys.craftedItems(userId)
  const xKey = queryKeys.research(userId)

  function cancelAndSnapshot(...keys) {
    const snap = {}
    for (const k of keys) {
      queryClient.cancelQueries({ queryKey: k })
      snap[JSON.stringify(k)] = queryClient.getQueryData(k)
    }
    return snap
  }

  function rollback(snap) {
    for (const [k, v] of Object.entries(snap)) {
      if (v !== undefined) queryClient.setQueryData(JSON.parse(k), v)
    }
  }

  function reconcile(...keys) {
    for (const k of keys) queryClient.invalidateQueries({ queryKey: k })
  }


  // ── Mutations: Recolección ──────────────────────────────────────────────────

  // mutationKey compartida con useRealtimeSync: Realtime no invalida buildings/resources
  // mientras haya recolecciones pendientes — el onSettled de la última reconcilia.
  const COLLECT_KEY = ['building-collect']

  const collectMutation = useMutation({
    mutationKey: COLLECT_KEY,
    mutationFn: ({ buildingType }) => apiPost('/api/building-collect', { buildingType }),
    onMutate: async ({ buildingType }) => {
      const snap = cancelAndSnapshot(bKey, rKey)
      const blds = queryClient.getQueryData(bKey)
      const res  = queryClient.getQueryData(rKey)
      if (blds && res) {
        const b = blds.find(x => x.type === buildingType)
        if (b) {
          const { resource, rate, cap } = buildingRate(buildingType, b.level)
          const elapsed = Math.max(0, (Date.now() - new Date(b.production_collected_at).getTime()) / 3_600_000)
          const produced = Math.min(cap, Math.floor(rate * elapsed))

          if (produced > 0) {
            queryClient.setQueryData(rKey, {
              ...res,
              [resource]: (res[resource] ?? 0) + produced,
            })
            queryClient.setQueryData(bKey, blds.map(x => {
              if (x.id !== b.id) return x
              return { ...x, production_collected_at: new Date().toISOString() }
            }))
          }
        }
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => {
      // Solo reconciliar cuando la última recolección en vuelo aterriza.
      // React Query ya ha decrementado isMutating antes de llamar onSettled,
      // así que si es 0, no queda ninguna recolección pendiente.
      if (queryClient.isMutating({ mutationKey: COLLECT_KEY }) === 0) {
        reconcile(bKey, rKey)
      }
    },
  })

  const _collectAllMutation = useMutation({
    mutationKey: COLLECT_KEY,
    mutationFn: () => apiPost('/api/building-collect-all', {}),
    onMutate: async () => {
      const snap = cancelAndSnapshot(bKey, rKey)
      const blds = queryClient.getQueryData(bKey)
      const res  = queryClient.getQueryData(rKey)
      if (blds && res) {
        const newRes = { ...res }
        const newBlds = blds.map(b => {
          if (!PRODUCTION_BUILDING_TYPES.includes(b.type) || !b.unlocked || b.level <= 0) return b
          const { resource, rate, cap } = buildingRate(b.type, b.level)
          const elapsed = Math.max(0, (Date.now() - new Date(b.production_collected_at).getTime()) / 3_600_000)
          const produced = Math.min(cap, Math.floor(rate * elapsed))
          if (produced <= 0) return b
          newRes[resource] = (newRes[resource] ?? 0) + produced
          return { ...b, production_collected_at: new Date().toISOString() }
        })
        queryClient.setQueryData(rKey, newRes)
        queryClient.setQueryData(bKey, newBlds)
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: COLLECT_KEY }) === 0) {
        reconcile(bKey, rKey)
      }
    },
  })

  // ── Mutations: Refinado + Taller (sistema unificado sin bloqueo) ─────────────

  const REFINE_KEY = ['refining-start']

  const refiningStartMutation = useMutation({
    mutationKey: REFINE_KEY,
    mutationFn: ({ recipeId, quantity }) => apiPost('/api/refining-start', { recipeId, quantity }),
    onMutate: async ({ recipeId, quantity }) => {
      const snap = cancelAndSnapshot(cKey, rKey)
      const crafted = queryClient.getQueryData(cKey)
      const res = queryClient.getQueryData(rKey)
      if (crafted && res) {
        const recipe = crafted.catalog.find(c => c.id === recipeId)
        if (recipe) {
          const newRes = { ...res }
          const newInv = { ...crafted.inventory }
          for (const inp of recipe.inputs ?? []) {
            if (inp.resource) newRes[inp.resource] = (newRes[inp.resource] ?? 0) - inp.qty * quantity
            if (inp.item) newInv[inp.item] = Math.max(0, (newInv[inp.item] ?? 0) - inp.qty * quantity)
          }
          // Optimistic: añadir o actualizar slot
          const existingSlots = [...(crafted.refiningSlots ?? [])]
          const idx = existingSlots.findIndex(s => s.recipe_id === recipeId && s.building_type === recipe.refinery_type)
          if (idx >= 0) {
            existingSlots[idx] = { ...existingSlots[idx], quantity: existingSlots[idx].quantity + quantity }
          } else {
            existingSlots.push({
              id: `opt-${Date.now()}`,
              building_type: recipe.refinery_type,
              recipe_id: recipeId,
              quantity,
              craft_started_at: new Date().toISOString(),
              unit_duration_ms: (recipe.craft_minutes ?? 1) * 60_000,
            })
          }
          queryClient.setQueryData(rKey, newRes)
          queryClient.setQueryData(cKey, { ...crafted, inventory: newInv, refiningSlots: existingSlots })
        }
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: REFINE_KEY }) === 0) {
        reconcile(cKey, rKey)
      }
    },
  })

  const refiningCollectMutation = useMutation({
    mutationFn: (slotId) => apiPost('/api/refining-collect', { slotId }),
    onMutate: async (slotId) => {
      const snap = cancelAndSnapshot(cKey)
      const crafted = queryClient.getQueryData(cKey)
      if (crafted) {
        const slots = [...(crafted.refiningSlots ?? [])]
        const idx = slots.findIndex(s => s.id === slotId)
        if (idx >= 0) {
          const slot = slots[idx]
          const now = Date.now()
          const startedAt = new Date(slot.craft_started_at).getTime()
          const completed = Math.min(slot.quantity, Math.floor((now - startedAt) / slot.unit_duration_ms))
          if (completed > 0) {
            const recipe = crafted.catalog.find(c => c.id === slot.recipe_id)
            const outputPerUnit = recipe?.output_qty ?? 1
            const newInv = { ...crafted.inventory }
            newInv[slot.recipe_id] = (newInv[slot.recipe_id] ?? 0) + completed * outputPerUnit
            const remaining = slot.quantity - completed
            if (remaining <= 0) {
              slots.splice(idx, 1)
            } else {
              slots[idx] = {
                ...slot,
                quantity: remaining,
                craft_started_at: new Date(startedAt + completed * slot.unit_duration_ms).toISOString(),
              }
            }
            queryClient.setQueryData(cKey, { ...crafted, inventory: newInv, refiningSlots: slots })
          }
        }
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => reconcile(cKey),
  })

  const refiningCollectAllMutation = useMutation({
    mutationFn: (buildingType) => apiPost('/api/refining-collect-all', { buildingType }),
    onMutate: async (buildingType) => {
      const snap = cancelAndSnapshot(cKey)
      const crafted = queryClient.getQueryData(cKey)
      if (crafted) {
        const slots = [...(crafted.refiningSlots ?? [])]
        const newInv = { ...crafted.inventory }
        const newSlots = []
        for (const slot of slots) {
          // Solo procesar slots del edificio indicado
          if (slot.building_type !== buildingType) { newSlots.push(slot); continue }
          const now = Date.now()
          const startedAt = new Date(slot.craft_started_at).getTime()
          const completed = Math.min(slot.quantity, Math.floor((now - startedAt) / slot.unit_duration_ms))
          if (completed > 0) {
            const recipe = crafted.catalog.find(c => c.id === slot.recipe_id)
            const outputPerUnit = recipe?.output_qty ?? 1
            newInv[slot.recipe_id] = (newInv[slot.recipe_id] ?? 0) + completed * outputPerUnit
            const remaining = slot.quantity - completed
            if (remaining > 0) {
              newSlots.push({
                ...slot,
                quantity: remaining,
                craft_started_at: new Date(startedAt + completed * slot.unit_duration_ms).toISOString(),
              })
            }
          } else {
            newSlots.push(slot)
          }
        }
        queryClient.setQueryData(cKey, { ...crafted, inventory: newInv, refiningSlots: newSlots })
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => reconcile(cKey),
  })

  // ── Mutations: Investigación ────────────────────────────────────────────────

  const researchStartMutation = useMutation({
    mutationFn: (nodeId) => apiPost('/api/research-start', { nodeId }),
    onError: err => notify.error(err.message),
    onSettled: () => reconcile(xKey, rKey),
  })

  const researchCollectMutation = useMutation({
    mutationFn: (nodeId) => apiPost('/api/research-collect', { nodeId }),
    onError: err => notify.error(err.message),
    onSettled: () => reconcile(xKey, rKey),
  })

  const ZERO_DELTA = { iron: 0, wood: 0, mana: 0 }
  const effectiveResources = resources
    ? Object.fromEntries(Object.entries(resources).map(([k, v]) =>
        [k, typeof v === 'number' ? v - (resourceDelta[k] ?? 0) : v]
      ))
    : null

  function handleOptimisticDeduct(costs) {
    setResourceDelta(d => {
      const next = { ...d }
      for (const [k, v] of Object.entries(costs)) next[k] = (next[k] ?? 0) + v
      return next
    })
  }

  function handleUpgradeStart() {
    setUpgradePending(false)
    setResourceDelta(ZERO_DELTA)
    reconcile(bKey, rKey)
  }

  function handleUpgradeCollect() {
    reconcile(bKey, rKey)
  }

  if (loading) return (
    <div className="text-text-3 text-[15px] p-10 text-center">Cargando base...</div>
  )

  const byType = Object.fromEntries((buildings ?? []).map(b => [b.type, b]))
  const RESOURCE_BUILDINGS = ['gold_mine', 'lumber_mill', 'mana_well', 'herb_garden']
  const REFINING_BUILDINGS = REFINING_BUILDING_TYPES
  const now = new Date()
  const isUpgrading = (type) => (buildings ?? []).some(b => b.type === type && b.upgrade_ends_at && new Date(b.upgrade_ends_at) > now)

  const recursosUpgrading   = upgradePending || RESOURCE_BUILDINGS.some(isUpgrading)
  const refinadoUpgrading   = upgradePending || REFINING_BUILDINGS.some(isUpgrading)
  const tallerUpgrading     = upgradePending || isUpgrading('laboratory')
  const bibliotecaUpgrading = upgradePending || isUpgrading('library')

  // ── Badges para zone pills ──────────────────────────────────────────────────
  const produccionBadge = anyReady
    ? Object.values(production).filter(p => p.isFull).length
    : 0

  const tallerSlotsReady = (refiningSlots ?? []).filter(s => {
    if (s.building_type !== 'laboratory') return false
    if (!s.unit_duration_ms || s.unit_duration_ms <= 0) return false
    const elapsed = now - new Date(s.craft_started_at).getTime()
    const completed = Math.min(s.quantity, Math.floor(elapsed / s.unit_duration_ms))
    return completed >= s.quantity
  }).length
  const tallerBadge = tallerSlotsReady

  const refinadoSlotsReady = (refiningSlots ?? []).filter(s => {
    if (!REFINING_BUILDING_TYPES.includes(s.building_type)) return false
    const elapsed = now - new Date(s.craft_started_at).getTime()
    const completed = Math.floor(elapsed / s.unit_duration_ms)
    return completed >= s.quantity
  }).length
  const refinadoBadge = refinadoSlotsReady

  const researchReady = research?.active && new Date(research.active.ends_at) <= now
  const bibliotecaBadge = researchReady ? 1 : 0

  const zoneBadges = {
    produccion: produccionBadge,
    refinado:   refinadoBadge,
    taller:     tallerBadge,
    biblioteca: bibliotecaBadge,
  }

  const sharedBuildingProps = {
    effectiveResources,
    onUpgradeStart:     handleUpgradeStart,
    onUpgradeCollect:   handleUpgradeCollect,
    onOptimisticDeduct: handleOptimisticDeduct,
    onUpgradePending:   setUpgradePending,
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <BaseHeader byType={byType} resources={effectiveResources} />

      <ZonePills active={activeZone} onChange={setActiveZone} badges={zoneBadges} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeZone}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeZone === 'produccion' && (
            <RecursosZone
              byType={byType}
              production={production}
              onCollect={(buildingType, collectType) => collectMutation.mutate({ buildingType, collectType })}
              anyUpgrading={recursosUpgrading}
              {...sharedBuildingProps}
            />
          )}

          {activeZone === 'refinado' && (
            <RefinadoZone
              byType={byType}
              effectiveResources={effectiveResources}
              catalog={catalog}
              inventory={inventory}
              refiningSlots={refiningSlots}
              onRefine={({ recipeId, quantity }) => refiningStartMutation.mutate({ recipeId, quantity })}
              onCollectAllSlots={(buildingType) => refiningCollectAllMutation.mutate(buildingType)}
              anyUpgrading={refinadoUpgrading}
              {...sharedBuildingProps}
            />
          )}

          {activeZone === 'taller' && (
            <TallerZone
              byType={byType}
              effectiveResources={effectiveResources}
              catalog={catalog}
              inventory={inventory}
              refiningSlots={refiningSlots}
              onRefine={({ recipeId, quantity }) => refiningStartMutation.mutate({ recipeId, quantity })}
              onCollectSlot={(slotId) => refiningCollectMutation.mutate(slotId)}
              anyUpgrading={tallerUpgrading}
              {...sharedBuildingProps}
            />
          )}

          {activeZone === 'biblioteca' && (
            <BibliotecaZone
              byType={byType}
              research={research}
              resources={effectiveResources}
              onResearchStart={(nodeId) => researchStartMutation.mutate(nodeId)}
              onResearchCollect={(nodeId) => researchCollectMutation.mutate(nodeId)}
              startPending={researchStartMutation.isPending}
              collectPending={researchCollectMutation.isPending}
              anyUpgrading={bibliotecaUpgrading}
              {...sharedBuildingProps}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
