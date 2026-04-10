import { useState, useEffect, useReducer } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useBuildings } from '../hooks/useBuildings'
import { useResources } from '../hooks/useResources'
import { useTraining } from '../hooks/useTraining'
import { useTrainingRooms } from '../hooks/useTrainingRooms'
import { usePotions } from '../hooks/usePotions'
import { useHeroRunes } from '../hooks/useHeroRunes'
import { useResearch } from '../hooks/useResearch'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { RESEARCH_NODES } from '../lib/gameConstants.js'
import { PRODUCTION_TYPES } from './base/constants.js'
import BaseHeader from './base/BaseHeader.jsx'
import ZonePills from './base/ZonePills.jsx'
import InicioZone from './base/InicioZone.jsx'
import RecursosZone from './base/RecursosZone.jsx'
import EntrenamientoZone from './base/EntrenamientoZone.jsx'
import LaboratorioZone from './base/LaboratorioZone.jsx'
import BibliotecaZone from './base/BibliotecaZone.jsx'

export default function Base({ mainRef }) {
  const userId      = useAppStore(s => s.userId)
  const activeTab   = useAppStore(s => s.activeTab)
  const heroId      = useHeroId()
  const queryClient = useQueryClient()
  const { buildings, loading } = useBuildings(userId)
  const { resources }          = useResources(userId)
  const { rooms: trainingRooms } = useTrainingRooms(userId)
  const { rows: trainingProgress } = useTraining(heroId)
  const { potions, craftingMap: potionCraftingMap }              = usePotions(userId)
  const { catalog: runesCatalog, inventory: runesInventory, craftingMap: runeCraftingMap } = useHeroRunes(userId)
  const { research }                       = useResearch(userId)
  const [activeZone,    setActiveZone]    = useState('inicio')
  const [resourceDelta, setResourceDelta] = useState({ iron: 0, wood: 0, mana: 0 })
  const [upgradePending, setUpgradePending] = useState(false)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  // Al volver a la Base desde otra sección, resetear siempre a Inicio
  useEffect(() => {
    if (activeTab === 'base') setActiveZone('inicio')
  }, [activeTab])

  // Scroll al top al cambiar de zona
  useEffect(() => {
    if (mainRef?.current) mainRef.current.scrollTop = 0
  }, [activeZone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(forceUpdate, 60_000)
    return () => clearInterval(id)
  }, [])

  const craftMutation = useMutation({
    mutationFn: async (potionId) => {
      await apiPost('/api/potion-craft', { potionId })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.potions(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
      ])
    },
    onSuccess: () => {},
    onError: err => toast.error(err.message),
  })

  const collectPotionMutation = useMutation({
    mutationFn: async (potionId) => {
      await apiPost('/api/potion-collect', { potionId })
      await queryClient.refetchQueries({ queryKey: queryKeys.potions(userId) })
    },
    onSuccess: () => toast.success('¡Poción recogida!'),
    onError: err => toast.error(err.message),
  })

  const runeCraftMutation = useMutation({
    mutationFn: async (runeId) => {
      await apiPost('/api/rune-craft', { runeId })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.heroRunes(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
      ])
    },
    onSuccess: () => {},
    onError: err => toast.error(err.message),
  })

  const collectRuneMutation = useMutation({
    mutationFn: async (runeId) => {
      await apiPost('/api/rune-collect', { runeId })
      await queryClient.refetchQueries({ queryKey: queryKeys.heroRunes(userId) })
    },
    onSuccess: () => toast.success('¡Runa recogida!'),
    onError: err => toast.error(err.message),
  })

  const labInventoryUpgradeMutation = useMutation({
    mutationFn: async () => {
      await apiPost('/api/lab-inventory-upgrade', {})
      await queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) })
    },
    onSuccess: () => toast.success('¡Inventario del laboratorio ampliado!'),
    onError: err => toast.error(err.message),
  })

  const researchStartMutation = useMutation({
    mutationFn: async (nodeId) => {
      await apiPost('/api/research-start', { nodeId })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.research(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
      ])
      return nodeId
    },
    onSuccess: (nodeId) => {
      const node = RESEARCH_NODES.find(n => n.id === nodeId)
      toast.success(`Investigando: ${node?.name ?? nodeId}`)
    },
    onError: err => toast.error(err.message),
  })

  const researchCollectMutation = useMutation({
    mutationFn: async (nodeId) => {
      await apiPost('/api/research-collect', { nodeId })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.research(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
      ])
      return nodeId
    },
    onSuccess: (nodeId) => {
      const node = RESEARCH_NODES.find(n => n.id === nodeId)
      toast.success(`¡${node?.name ?? nodeId} completado!`)
    },
    onError: err => toast.error(err.message),
  })

  const effectiveResources = resources
    ? { ...resources, iron: (resources.iron ?? 0) - resourceDelta.iron, wood: resources.wood - resourceDelta.wood, mana: resources.mana - resourceDelta.mana }
    : null

  function handleOptimisticDeduct({ iron = 0, wood = 0, mana = 0 }) {
    setResourceDelta(d => ({ iron: d.iron + iron, wood: d.wood + wood, mana: d.mana + mana }))
  }

  async function handleUpgradeStart() {
    setUpgradePending(false)
    await Promise.all([
      queryClient.refetchQueries({ queryKey: queryKeys.buildings(userId) }),
      queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
    ])
    setResourceDelta({ iron: 0, wood: 0, mana: 0 })
  }

  async function handleUpgradeCollect() {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: queryKeys.buildings(userId) }),
      queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
    ])
  }

  if (loading) return (
    <div className="text-text-3 text-[15px] p-10 text-center">Cargando base...</div>
  )

  const byType = Object.fromEntries((buildings ?? []).map(b => [b.type, b]))
  const nexus  = byType['energy_nexus']

  const nexusData = nexus ? (() => {
    const allBuildings = Object.values(byType)
    const produced = nexus.level * 30
    const consumed = allBuildings
      .filter(b => PRODUCTION_TYPES.includes(b.type) && b.unlocked !== false)
      .reduce((s, b) => s + b.level * 10, 0)
    const balance   = produced - consumed
    const deficit   = balance < 0
    const barPct    = consumed > 0 ? Math.min(100, Math.round((produced / consumed) * 100)) : 100
    const efficiency = consumed > 0 ? Math.min(100, Math.round((produced / consumed) * 100)) : 100
    const ratio     = consumed > 0 ? Math.min(1, produced / consumed) : 1
    return { produced, consumed, balance, deficit, barPct, efficiency, ratio }
  })() : null

  const nexusRatio   = nexusData?.ratio ?? 1
  const RESOURCE_BUILDINGS = ['energy_nexus', 'gold_mine', 'lumber_mill', 'mana_well']
  const now = new Date()
  const isUpgrading = (type) => (buildings ?? []).some(b => b.type === type && b.upgrade_ends_at && new Date(b.upgrade_ends_at) > now)

  const recursosUpgrading      = upgradePending || RESOURCE_BUILDINGS.some(isUpgrading)
  const entrenamientoUpgrading = upgradePending || (trainingRooms ?? []).some(r => r.building_ends_at && new Date(r.building_ends_at) > now)
  const laboratorioUpgrading   = upgradePending || isUpgrading('laboratory')
  const bibliotecaUpgrading    = upgradePending || isUpgrading('library')

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

      <ZonePills active={activeZone} onChange={setActiveZone} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeZone}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeZone === 'inicio' && (
            <InicioZone
              byType={byType}
              nexusData={nexusData}
              trainingRooms={trainingRooms}
              trainingProgress={trainingProgress}
              potions={potions}
              potionCraftingMap={potionCraftingMap}
              runeCraftingMap={runeCraftingMap}
              research={research}
              onGoTo={setActiveZone}
            />
          )}

          {activeZone === 'recursos' && (
            <RecursosZone
              byType={byType}
              nexusData={nexusData}
              nexusRatio={nexusRatio}
              anyUpgrading={recursosUpgrading}
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

          {activeZone === 'laboratorio' && (
            <LaboratorioZone
              byType={byType}
              potions={potions}
              potionCraftingMap={potionCraftingMap}
              runesCatalog={runesCatalog}
              runesInventory={runesInventory}
              runeCraftingMap={runeCraftingMap}
              craftPending={craftMutation.isPending}
              collectPending={collectPotionMutation.isPending}
              onCraft={(potionId) => craftMutation.mutate(potionId)}
              onCollect={(potionId) => collectPotionMutation.mutate(potionId)}
              onRuneCraft={(runeId) => runeCraftMutation.mutate(runeId)}
              runeCraftPending={runeCraftMutation.isPending}
              runeCollectPending={collectRuneMutation.isPending}
              onRuneCollect={(runeId) => collectRuneMutation.mutate(runeId)}
              onLabInventoryUpgrade={() => labInventoryUpgradeMutation.mutate()}
              labInventoryUpgradePending={labInventoryUpgradeMutation.isPending}
              anyUpgrading={laboratorioUpgrading}
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
