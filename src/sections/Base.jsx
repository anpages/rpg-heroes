import { useState, useEffect, useReducer } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useBuildings } from '../hooks/useBuildings'
import { useResources } from '../hooks/useResources'
import { useBuildingProduction } from '../hooks/useBuildingProduction'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { useTraining, hasReadyPoint } from '../hooks/useTraining'
import { useTrainingRooms } from '../hooks/useTrainingRooms'
import { usePotions } from '../hooks/usePotions'
import { useResearch } from '../hooks/useResearch'
import { REFINING_BUILDING_TYPES, buildingRateAndCap, PRODUCTION_BUILDING_TYPES } from '../lib/gameConstants'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import BaseHeader from './base/BaseHeader.jsx'
import ZonePills from './base/ZonePills.jsx'
import RecursosZone from './base/RecursosZone.jsx'
import RefinadoZone from './base/RefinadoZone.jsx'
import TallerZone from './base/TallerZone.jsx'
import EntrenamientoZone from './base/EntrenamientoZone.jsx'
import BibliotecaZone from './base/BibliotecaZone.jsx'

export default function Base({ mainRef }) {
  const userId      = useAppStore(s => s.userId)
  const activeTab   = useAppStore(s => s.activeTab)
  const heroId      = useHeroId()
  const queryClient = useQueryClient()
  const { buildings, loading } = useBuildings(userId)
  const { resources }          = useResources(userId)
  const { production, anyReady } = useBuildingProduction(userId)
  const { catalog, inventory, queue } = useCraftedItems(userId)
  const { rooms: trainingRooms } = useTrainingRooms(userId)
  const { rows: trainingProgress } = useTraining(heroId)
  const { potions, craftingMap: potionCraftingMap } = usePotions(userId)
  const { research }                       = useResearch(userId)
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
    coal: 'carbón', fiber: 'fibra', arcane_dust: 'polvo arcano', flowers: 'flores',
  }

  const bKey = queryKeys.buildings(userId)
  const rKey = queryKeys.resources(userId)
  const cKey = queryKeys.craftedItems(userId)
  const pKey = queryKeys.potions(userId)
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
    mutationFn: (buildingType) => apiPost('/api/building-collect', { buildingType }),
    onMutate: async (buildingType) => {
      const snap = cancelAndSnapshot(bKey, rKey)
      const blds = queryClient.getQueryData(bKey)
      const res  = queryClient.getQueryData(rKey)
      if (blds && res) {
        const b = blds.find(x => x.type === buildingType)
        if (b) {
          const { resource, rate, cap, secondary } = buildingRateAndCap(buildingType, b.level)
          const elapsed = Math.max(0, (Date.now() - new Date(b.production_collected_at).getTime()) / 3_600_000)
          const produced = Math.min(Math.floor(rate * elapsed), cap)
          let secProduced = 0
          if (secondary) secProduced = Math.min(Math.floor(secondary.rate * elapsed), secondary.cap)

          if (produced > 0 || secProduced > 0) {
            const nowIso = new Date().toISOString()
            queryClient.setQueryData(rKey, {
              ...res,
              [resource]: (res[resource] ?? 0) + produced,
              ...(secProduced > 0 ? { [secondary.resource]: (res[secondary.resource] ?? 0) + secProduced } : {}),
            })
            queryClient.setQueryData(bKey, blds.map(x =>
              x.id === b.id ? { ...x, production_collected_at: nowIso } : x
            ))
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
        const nowIso = new Date().toISOString()
        const newRes = { ...res }
        const newBlds = blds.map(b => {
          if (!PRODUCTION_BUILDING_TYPES.includes(b.type) || !b.unlocked || b.level <= 0) return b
          const { resource, rate, cap, secondary } = buildingRateAndCap(b.type, b.level)
          const elapsed = Math.max(0, (Date.now() - new Date(b.production_collected_at).getTime()) / 3_600_000)
          const produced = Math.min(Math.floor(rate * elapsed), cap)
          if (produced > 0) newRes[resource] = (newRes[resource] ?? 0) + produced
          if (secondary) {
            const secProduced = Math.min(Math.floor(secondary.rate * elapsed), secondary.cap)
            if (secProduced > 0) newRes[secondary.resource] = (newRes[secondary.resource] ?? 0) + secProduced
          }
          return (produced > 0) ? { ...b, production_collected_at: nowIso } : b
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

  // ── Mutations: Crafteo de items ─────────────────────────────────────────────

  const craftItemMutation = useMutation({
    mutationFn: (recipeId) => apiPost('/api/craft-start', { recipeId }),
    onMutate: async (recipeId) => {
      const snap = cancelAndSnapshot(cKey, rKey)
      const crafted = queryClient.getQueryData(cKey)
      const res     = queryClient.getQueryData(rKey)
      if (crafted && res) {
        const recipe = crafted.catalog.find(c => c.id === recipeId)
        if (recipe) {
          const newRes = { ...res }
          const newInv = { ...crafted.inventory }
          for (const inp of recipe.inputs ?? []) {
            if (inp.resource) newRes[inp.resource] = (newRes[inp.resource] ?? 0) - inp.qty
            if (inp.item)     newInv[inp.item] = Math.max(0, (newInv[inp.item] ?? 0) - inp.qty)
          }
          const optimisticCraft = {
            id: `opt-${Date.now()}`,
            recipe_id: recipeId,
            craft_ends_at: new Date(Date.now() + (recipe.craft_minutes ?? 1) * 60_000).toISOString(),
            building_type: recipe.refinery_type ?? null,
          }
          queryClient.setQueryData(rKey, newRes)
          queryClient.setQueryData(cKey, {
            ...crafted,
            inventory: newInv,
            queue: [...crafted.queue, optimisticCraft],
          })
        }
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => reconcile(cKey, rKey),
  })

  const collectItemMutation = useMutation({
    mutationFn: (craftId) => apiPost('/api/craft-collect', { craftId }),
    onMutate: async (craftId) => {
      const snap = cancelAndSnapshot(cKey)
      const crafted = queryClient.getQueryData(cKey)
      if (crafted) {
        const craft = crafted.queue.find(q => q.id === craftId)
        if (craft) {
          const recipe = crafted.catalog.find(c => c.id === craft.recipe_id)
          const outputQty = recipe?.output_qty ?? 1
          const newInv = { ...crafted.inventory }
          newInv[craft.recipe_id] = (newInv[craft.recipe_id] ?? 0) + outputQty
          queryClient.setQueryData(cKey, {
            ...crafted,
            inventory: newInv,
            queue: crafted.queue.filter(q => q.id !== craftId),
          })
        }
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => reconcile(cKey),
  })

  // ── Mutations: Pociones ─────────────────────────────────────────────────────

  const craftPotionMutation = useMutation({
    mutationFn: (potionId) => apiPost('/api/potion-craft', { potionId }),
    onMutate: async (potionId) => {
      const snap = cancelAndSnapshot(pKey, rKey, cKey)
      const potionData = queryClient.getQueryData(pKey)
      const res        = queryClient.getQueryData(rKey)
      const crafted    = queryClient.getQueryData(cKey)
      if (potionData && res) {
        const potion = potionData.potions?.find(p => p.id === potionId)
        if (potion) {
          const newRes = { ...res }
          const newInv = crafted ? { ...crafted.inventory } : {}
          for (const inp of potion.recipe_items ?? []) {
            if (inp.resource) newRes[inp.resource] = (newRes[inp.resource] ?? 0) - inp.qty
            if (inp.item) newInv[inp.item] = Math.max(0, (newInv[inp.item] ?? 0) - inp.qty)
          }
          const optCraft = {
            id: `opt-${Date.now()}`,
            potion_id: potionId,
            craft_ends_at: new Date(Date.now() + (potion.craft_minutes ?? 1) * 60_000).toISOString(),
          }
          const newMap = { ...potionData.craftingMap }
          newMap[potionId] = [...(newMap[potionId] ?? []), optCraft]
          queryClient.setQueryData(rKey, newRes)
          queryClient.setQueryData(pKey, { ...potionData, craftingMap: newMap })
          if (crafted) queryClient.setQueryData(cKey, { ...crafted, inventory: newInv })
        }
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => reconcile(pKey, rKey, cKey),
  })

  const collectPotionMutation = useMutation({
    mutationFn: (craftId) => apiPost('/api/potion-collect', { craftId }),
    onMutate: async (craftId) => {
      const snap = cancelAndSnapshot(pKey)
      const potionData = queryClient.getQueryData(pKey)
      if (potionData) {
        let potionId = null
        for (const [pid, crafts] of Object.entries(potionData.craftingMap ?? {})) {
          if (crafts.some(c => c.id === craftId)) { potionId = pid; break }
        }
        if (potionId) {
          const newMap = { ...potionData.craftingMap }
          newMap[potionId] = (newMap[potionId] ?? []).filter(c => c.id !== craftId)
          const newPotions = potionData.potions.map(p =>
            p.id === potionId ? { ...p, quantity: (p.quantity ?? 0) + 1 } : p
          )
          queryClient.setQueryData(pKey, { ...potionData, potions: newPotions, craftingMap: newMap })
        }
      }
      return snap
    },
    onError: (err, _, snap) => { rollback(snap); notify.error(err.message) },
    onSettled: () => reconcile(pKey),
  })

  const labInventoryUpgradeMutation = useMutation({
    mutationFn: () => apiPost('/api/lab-inventory-upgrade', {}),
    onSuccess: () => notify.success('Inventario del laboratorio ampliado'),
    onError: err => notify.error(err.message),
    onSettled: () => reconcile(rKey),
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

  const recursosUpgrading      = upgradePending || RESOURCE_BUILDINGS.some(isUpgrading)
  const refinadoUpgrading      = upgradePending || REFINING_BUILDINGS.some(isUpgrading)
  const entrenamientoUpgrading = upgradePending || (trainingRooms ?? []).some(r => r.building_ends_at && new Date(r.building_ends_at) > now)
  const tallerUpgrading        = upgradePending || isUpgrading('laboratory')
  const bibliotecaUpgrading    = upgradePending || isUpgrading('library')

  // ── Badges para zone pills ──────────────────────────────────────────────────
  const produccionBadge = anyReady
    ? Object.values(production).filter(p => p.canCollect).length
    : 0

  const craftQueueReady = queue.filter(c => !c.building_type && new Date(c.craft_ends_at) <= now).length
  const potionCraftReady = Object.values(potionCraftingMap ?? {}).flat().filter(c => new Date(c.craft_ends_at) <= now).length
  const tallerBadge = craftQueueReady + potionCraftReady

  const progressByStat = Object.fromEntries((trainingProgress ?? []).map(r => [r.stat, r]))
  const entrenamientoBadge = (trainingRooms ?? []).filter(r =>
    r.built_at !== null && hasReadyPoint(progressByStat[r.stat], r.level)
  ).length

  const refinadoQueueReady = queue.filter(c =>
    c.building_type && REFINING_BUILDING_TYPES.includes(c.building_type) && new Date(c.craft_ends_at) <= now
  ).length
  const refinadoBadge = refinadoQueueReady

  const researchReady = research?.active && new Date(research.active.ends_at) <= now
  const bibliotecaBadge = researchReady ? 1 : 0

  const zoneBadges = {
    produccion: produccionBadge,
    refinado: refinadoBadge,
    taller: tallerBadge,
    entrenamiento: entrenamientoBadge,
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
              onCollect={(type) => collectMutation.mutate(type)}
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
              queue={queue}
              onCraft={(recipeId) => craftItemMutation.mutate(recipeId)}
              onCollect={(craftId) => collectItemMutation.mutate(craftId)}
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
              queue={queue}
              onCraftItem={(recipeId) => craftItemMutation.mutate(recipeId)}
              onCollectItem={(craftId) => collectItemMutation.mutate(craftId)}
              potions={potions}
              potionCraftingMap={potionCraftingMap}
              onCraftPotion={(potionId) => craftPotionMutation.mutate(potionId)}
              onCollectPotion={(craftId) => collectPotionMutation.mutate(craftId)}
              onLabInventoryUpgrade={() => labInventoryUpgradeMutation.mutate()}
              labInventoryUpgradePending={labInventoryUpgradeMutation.isPending}
              anyUpgrading={tallerUpgrading}
              {...sharedBuildingProps}
            />
          )}

          {activeZone === 'entrenamiento' && (
            <EntrenamientoZone
              trainingRooms={trainingRooms}
              trainingProgress={trainingProgress}
              resources={effectiveResources}
              userId={userId}
              heroId={heroId}
              byType={byType}
              anyUpgrading={entrenamientoUpgrading}
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
