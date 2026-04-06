import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { useBuildings } from '../hooks/useBuildings'
import { useResources } from '../hooks/useResources'
import { Coins, Axe, Sparkles, Swords, Wrench, Clock, ChevronRight, Zap, Hammer, BookOpen, Lock } from 'lucide-react'
import { motion } from 'framer-motion'

const listVariants = {
  animate: { transition: { staggerChildren: 0.07 } },
}
const cardVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

const BUILDING_META = {
  energy_nexus: {
    name: 'Nexo Arcano',
    description: 'Canaliza la energía del mundo para alimentar las estructuras de la base.',
    icon: Zap,
    color: '#0891b2',
    effect: (level) => `${level * 30} energía`,
    nextEffect: (level) => `${(level + 1) * 30} energía`,
  },
  gold_mine: {
    name: 'Mina de Oro',
    description: 'Extrae oro de las profundidades de la tierra.',
    icon: Coins,
    color: '#d97706',
    effect: (level) => `${2 + (level - 1)} oro/min`,
    nextEffect: (level) => `${2 + level} oro/min`,
  },
  lumber_mill: {
    name: 'Aserradero',
    description: 'Procesa la madera del bosque cercano.',
    icon: Axe,
    color: '#16a34a',
    effect: (level) => `${1 + (level - 1)} madera/min`,
    nextEffect: (level) => `${1 + level} madera/min`,
  },
  mana_well: {
    name: 'Pozo de Maná',
    description: 'Canaliza energía arcana desde las líneas ley.',
    icon: Sparkles,
    color: '#7c3aed',
    effect: (level) => `${1 + (level - 1)} maná/min`,
    nextEffect: (level) => `${1 + level} maná/min`,
  },
  barracks: {
    name: 'Cuartel',
    description: 'Forja los atributos fundamentales de tu héroe, ampliando su potencial para equipar cartas de habilidad.',
    icon: Swords,
    color: '#dc2626',
    effect: (level) => level === 1 ? 'Sin bonificación' : `+${(level - 1) * 2} fue · +${(level - 1) * 2} agi · +${(level - 1) * 2} int`,
    nextEffect: (level) => `+${level * 2} fue · +${level * 2} agi · +${level * 2} int`,
  },
  workshop: {
    name: 'Taller',
    description: 'Mejora el botín de las expediciones y amplía la capacidad de la mochila.',
    icon: Wrench,
    color: '#0369a1',
    effect: (level) => level === 1
      ? '20 espacios de mochila'
      : `+${(level - 1) * 5}% botín · ${20 + (level - 1) * 5} espacios`,
    nextEffect: (level) => `+${level * 5}% botín · ${20 + level * 5} espacios`,
  },
  forge: {
    name: 'Herrería',
    description: 'Repara el equipo dañado. Mayor nivel reduce el coste de reparación.',
    icon: Hammer,
    color: '#b45309',
    effect: (level) => level === 1 ? 'Sin descuento' : `-${(level - 1) * 5}% coste de reparación`,
    nextEffect: (level) => `-${level * 5}% coste de reparación`,
  },
  library: {
    name: 'Biblioteca',
    description: 'Custodia las cartas de habilidad. Cada nivel amplía el mazo que puedes equipar.',
    icon: BookOpen,
    color: '#0f766e',
    effect: (level) => `${1 + level * 2} cartas equipables`,
    nextEffect: (level) => `${1 + (level + 1) * 2} cartas equipables`,
  },
}

function upgradeCost(type, level) {
  switch (type) {
    case 'barracks':
      return { gold: Math.round(100 * Math.pow(level, 1.8)), wood: Math.round(55 * Math.pow(level, 1.5)) }
    case 'workshop':
      return { gold: Math.round(80  * Math.pow(level, 1.7)), wood: Math.round(50 * Math.pow(level, 1.5)) }
    case 'forge':
      return { gold: Math.round(70  * Math.pow(level, 1.6)), wood: Math.round(35 * Math.pow(level, 1.4)), mana: Math.round(25 * Math.pow(level, 1.3)) }
    case 'library':
      return { gold: Math.round(70  * Math.pow(level, 1.6)), mana: Math.round(45 * Math.pow(level, 1.5)) }
    default: // energy_nexus, gold_mine, lumber_mill, mana_well
      return { gold: Math.round(60  * Math.pow(level, 1.6)), wood: Math.round(36 * Math.pow(level, 1.4)) }
  }
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function fmtTime(seconds) {
  if (seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function BuildingCard({ building, resources, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending, nexusData, nexusRatio, featured, anyUpgrading }) {
  const [optimisticEndsAt, setOptimisticEndsAt] = useState(null)

  useEffect(() => {
    if (building.upgrade_ends_at) setOptimisticEndsAt(null)
  }, [building.upgrade_ends_at])

  const effectiveBuilding = optimisticEndsAt
    ? { ...building, upgrade_started_at: new Date().toISOString(), upgrade_ends_at: optimisticEndsAt }
    : building

  const meta = BUILDING_META[effectiveBuilding.type]
  const { level } = effectiveBuilding
  const hasUpgrade = !!effectiveBuilding.upgrade_ends_at
  const { secondsLeft, loading, mountedRef } = useUpgradeTimer(effectiveBuilding, () => {
    setOptimisticEndsAt(null)
    onUpgradeCollect()
  })

  if (!meta) return null

  const cost = upgradeCost(building.type, level)
  const Icon = meta.icon
  const totalSeconds = level * level * 10 * 60
  const elapsed = hasUpgrade ? totalSeconds - (secondsLeft ?? totalSeconds) : 0
  const pct = hasUpgrade ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  const canAfford = resources
    && resources.gold >= cost.gold
    && (cost.wood === undefined || resources.wood >= cost.wood)
    && (cost.mana === undefined || resources.mana >= cost.mana)
  const blockedByOther = !hasUpgrade && anyUpgrading

  async function handleUpgradeStart() {
    const durationMs = building.level * building.level * 10 * 60 * 1000
    // eslint-disable-next-line react-hooks/purity
    setOptimisticEndsAt(new Date(Date.now() + durationMs).toISOString())
    onOptimisticDeduct(cost)
    onUpgradePending(true)

    try {
      await apiPost('/api/building-upgrade-start', { buildingId: building.id })
      onUpgradePending(false)
      onUpgradeStart()
    } catch (err) {
      setOptimisticEndsAt(null)
      onOptimisticDeduct({ gold: -cost.gold, wood: -(cost.wood ?? 0), mana: -(cost.mana ?? 0) })
      onUpgradePending(false)
      toast.error(err.message)
    }
  }

  return (
    <div
      className={`bc-accent flex flex-col gap-3.5 rounded-xl p-5 h-full transition-[box-shadow,border-color] duration-200
        ${featured
          ? 'border border-[var(--accent-border)] bg-[linear-gradient(180deg,var(--accent-bg)_0%,var(--surface)_55%)] shadow-[0_0_0_1px_var(--accent-border),var(--shadow-sm)] hover:shadow-[0_0_0_1px_var(--accent-border),var(--shadow-md)]'
          : 'bg-surface border border-border shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--accent-border)]'
        }`}
      style={{ '--accent': meta.color }}
    >
      {/* Top */}
      <div className="flex gap-3.5 items-start flex-1">
        <div className={`w-12 h-12 rounded-[10px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0${featured ? ' animate-nexo-pulse' : ''}`}>
          <Icon size={24} strokeWidth={1.8} color={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-[15px] font-bold text-text leading-[1.2]">{meta.name}</h3>
            <span className="text-[13px] font-bold text-[var(--accent)] bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-[6px] px-2 py-0.5 whitespace-nowrap flex-shrink-0">
              Nv. {level}
            </span>
          </div>
          <p className="text-[13px] text-text-3 leading-[1.5] mb-1.5 line-clamp-3">{meta.description}</p>
          <p className="text-[13px] font-semibold text-[var(--accent)]">
            {meta.effect(level)}
            {!hasUpgrade && <span className="font-medium text-text-3"> → {meta.nextEffect(level)}</span>}
          </p>
          {nexusRatio !== undefined && nexusRatio < 1 && (
            <p className="text-[12px] font-semibold text-[#d97706] -mt-1">
              ⚡ Energía insuficiente · tasa real reducida al {Math.round(nexusRatio * 100)}%
            </p>
          )}
        </div>
      </div>

      {/* Nexus panel */}
      {nexusData && (
        <div className="flex flex-col gap-2.5 pt-3.5 border-t border-border">
          <div className="grid grid-cols-3">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[20px] font-bold leading-none text-[var(--accent)]">{nexusData.produced}</span>
              <span className="text-[11px] font-medium text-text-3 uppercase tracking-[0.06em]">Producción</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-x border-border">
              <span className="text-[20px] font-bold leading-none text-[var(--accent)]">{nexusData.consumed}</span>
              <span className="text-[11px] font-medium text-text-3 uppercase tracking-[0.06em]">Consumo</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className={`text-[20px] font-bold leading-none ${nexusData.deficit ? 'text-error-text' : 'text-success-text'}`}>
                {nexusData.deficit ? `−${Math.abs(nexusData.balance)}` : `+${nexusData.balance}`}
              </span>
              <span className={`text-[11px] font-medium uppercase tracking-[0.06em] ${nexusData.deficit ? 'text-error-text opacity-70' : 'text-text-3'}`}>
                {nexusData.deficit ? `${nexusData.efficiency}% efic.` : 'Excedente'}
              </span>
            </div>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-[400ms] ${nexusData.deficit ? 'bg-error-text' : 'bg-[var(--accent)]'}`}
              style={{ width: `${nexusData.barPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Upgrade progress */}
      {hasUpgrade && (
        <div className="flex flex-col gap-2 pt-3 border-t border-border mt-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--accent)]">→ Nv. {level + 1}</span>
            <span className="flex items-center gap-1 text-[13px] font-semibold text-text-3 whitespace-nowrap flex-shrink-0">
              <Clock size={12} strokeWidth={2} />
              {loading ? 'Aplicando...' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
            </span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full"
              style={{
                width: `${pct}%`,
                transition: mountedRef.current ? 'width 1s linear' : 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom — costs + button */}
      {!hasUpgrade && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t border-border mt-auto">
          <div className="flex gap-1.5 flex-wrap">
            <span className={`flex items-center gap-1 text-[13px] font-semibold ${resources?.gold >= cost.gold ? 'text-success-text' : 'text-error-text'}`}>
              <Coins size={12} strokeWidth={2} />
              {fmt(cost.gold)}
            </span>
            {cost.wood !== undefined && (
              <span className={`flex items-center gap-1 text-[13px] font-semibold ${resources?.wood >= cost.wood ? 'text-success-text' : 'text-error-text'}`}>
                <Axe size={12} strokeWidth={2} />
                {fmt(cost.wood)}
              </span>
            )}
            {cost.mana !== undefined && (
              <span className={`flex items-center gap-1 text-[13px] font-semibold ${resources?.mana >= cost.mana ? 'text-success-text' : 'text-error-text'}`}>
                <Sparkles size={12} strokeWidth={2} />
                {fmt(cost.mana)}
              </span>
            )}
          </div>
          <motion.button
            className="btn btn--primary btn--sm sm:w-auto w-full justify-center"
            onClick={handleUpgradeStart}
            disabled={!canAfford || blockedByOther}
            title={blockedByOther ? 'Ya hay un edificio en construcción' : undefined}
            whileTap={(!canAfford || blockedByOther) ? {} : { scale: 0.96 }}
            whileHover={(!canAfford || blockedByOther) ? {} : { scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <span>Mejorar</span><ChevronRight size={13} strokeWidth={2} />
          </motion.button>
        </div>
      )}
    </div>
  )
}


const UNLOCK_REQUIREMENTS = {
  workshop:    { name: 'Cuartel',     level: 2 },
  lumber_mill: { name: 'Nexo Arcano', level: 2 },
  forge:       { name: 'Taller',      level: 2 },
  mana_well:   { name: 'Taller',      level: 2 },
  library:     { name: 'Mina de Oro', level: 3 },
}

function LockedBuildingCard({ type }) {
  const meta = BUILDING_META[type]
  const req  = UNLOCK_REQUIREMENTS[type]
  if (!meta || !req) return null
  const Icon = meta.icon
  return (
    <div
      className="bc-accent flex flex-col gap-3.5 rounded-xl p-5 bg-surface border border-border shadow-[var(--shadow-sm)] h-full opacity-50 pointer-events-none"
      style={{ '--accent': meta.color }}
    >
      <div className="flex gap-3.5 items-start flex-1">
        <div className="w-12 h-12 rounded-[10px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
          <Icon size={24} strokeWidth={1.8} color={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-[15px] font-bold text-text leading-[1.2]">{meta.name}</h3>
            <Lock size={14} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
          </div>
          <p className="text-[13px] text-text-3 leading-[1.5] line-clamp-3">{meta.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3 pt-3 border-t border-border mt-auto">
        <Lock size={11} strokeWidth={2.5} />
        Requiere {req.name} Nv.{req.level}
      </div>
    </div>
  )
}

const PRODUCTION_TYPES = ['gold_mine', 'lumber_mill', 'mana_well']
const UTILITY_TYPES    = ['barracks', 'workshop', 'forge', 'library']

const BUILDING_GROUPS = [
  {
    id:    'energy',
    label: 'Energía',
    types: ['energy_nexus'],
    grid:  'single',
  },
  {
    id:    'production',
    label: 'Producción',
    types: ['gold_mine', 'lumber_mill', 'mana_well'],
    grid:  'three',
  },
  {
    id:    'upgrades',
    label: 'Mejoras',
    types: ['barracks', 'workshop', 'forge', 'library'],
    grid:  'four',
  },
]

const GRID_CLASS = {
  single: 'grid grid-cols-1',
  three:  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch',
  four:   'grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch',
}

function useUpgradeTimer(building, onUpgradeCollect) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(false)
  const collectingRef = useRef(false)

  useEffect(() => {
    const hasUpgrade = !!building.upgrade_ends_at
    if (!hasUpgrade) {
      setSecondsLeft(null)
      setLoading(false)
      mountedRef.current = false
      collectingRef.current = false
      return
    }
    const endTime = new Date(building.upgrade_ends_at)

    async function autoCollect() {
      if (collectingRef.current) return
      collectingRef.current = true
      setLoading(true)
      try {
        await apiPost('/api/building-upgrade-collect', { buildingId: building.id })
        onUpgradeCollect()
        setLoading(false)
      } catch (err) {
        toast.error(err.message)
        setLoading(false)
        collectingRef.current = false
      }
    }

    function tick() {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) autoCollect()
    }
    tick()
    requestAnimationFrame(() => { mountedRef.current = true })
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building.upgrade_ends_at, building.id])

  return { secondsLeft, loading, mountedRef }
}


function Base() {
  const userId      = useAppStore(s => s.userId)
  const queryClient = useQueryClient()
  const { buildings, loading } = useBuildings(userId)
  const { resources } = useResources(userId)
  const [resourceDelta, setResourceDelta] = useState({ gold: 0, wood: 0, mana: 0 })
  const [upgradePending, setUpgradePending] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setResourceDelta({ gold: 0, wood: 0, mana: 0 }) }, [resources])

  const effectiveResources = resources
    ? { ...resources, gold: resources.gold - resourceDelta.gold, wood: resources.wood - resourceDelta.wood, mana: resources.mana - resourceDelta.mana }
    : null

  function handleOptimisticDeduct({ gold = 0, wood = 0, mana = 0 }) {
    setResourceDelta(d => ({ gold: d.gold + gold, wood: d.wood + wood, mana: d.mana + mana }))
  }

  function handleUpgradeStart() {
    queryClient.invalidateQueries({ queryKey: queryKeys.buildings(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
  }
  function handleUpgradeCollect() {
    queryClient.invalidateQueries({ queryKey: queryKeys.buildings(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
  }

  if (loading) return (
    <div className="text-text-3 text-[15px] p-10 text-center">Cargando base...</div>
  )

  const byType = Object.fromEntries((buildings ?? []).map(b => [b.type, b]))
  const nexus = byType['energy_nexus']

  const nexusData = nexus ? (() => {
    const allBuildings = Object.values(byType)
    const produced         = nexus.level * 30
    const consumedProduction = allBuildings.filter(b => PRODUCTION_TYPES.includes(b.type) && b.unlocked !== false).reduce((s, b) => s + b.level * 10, 0)
    const consumedUtility    = allBuildings.filter(b => UTILITY_TYPES.includes(b.type)    && b.unlocked !== false).reduce((s, b) => s + b.level * 5,  0)
    const consumed           = consumedProduction + consumedUtility
    const balance = produced - consumed
    const deficit = balance < 0
    const barPct = consumed > 0 ? Math.min(100, Math.round((produced / consumed) * 100)) : 100
    const efficiency = consumed > 0 ? Math.min(100, Math.round((produced / consumed) * 100)) : 100
    const ratio = consumed > 0 ? Math.min(1, produced / consumed) : 1
    return { produced, consumed, balance, deficit, barPct, efficiency, ratio }
  })() : null

  const nexusRatio = nexusData?.ratio ?? 1
  const anyUpgrading = upgradePending || (buildings ?? []).some(
    b => b.upgrade_ends_at && new Date(b.upgrade_ends_at) > new Date()
  )

  return (
    <div className="flex flex-col gap-6 max-w-[960px] mx-auto">
      <div className="section-header">
        <h2 className="section-title">Base</h2>
        <p className="section-subtitle">Mejora tus edificios para aumentar la producción de recursos y las capacidades de tu héroe.</p>
      </div>

      <motion.div
        className="flex flex-col gap-8"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        {BUILDING_GROUPS.map(group => {
          const groupBuildings = group.types.map(t => byType[t]).filter(Boolean)
          if (!groupBuildings.length) return null
          return (
            <motion.div key={group.id} className="flex flex-col gap-3" variants={cardVariants}>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">{group.label}</p>
              <div className={GRID_CLASS[group.grid]}>
                {groupBuildings.map(b =>
                  b.unlocked === false ? (
                    <LockedBuildingCard key={b.id} type={b.type} />
                  ) : (
                    <BuildingCard
                      key={b.id}
                      building={b}
                      resources={effectiveResources}
                      featured={b.type === 'energy_nexus'}
                      nexusData={b.type === 'energy_nexus' ? nexusData : undefined}
                      nexusRatio={PRODUCTION_TYPES.includes(b.type) ? nexusRatio : undefined}
                      onUpgradeStart={handleUpgradeStart}
                      onUpgradeCollect={handleUpgradeCollect}
                      onOptimisticDeduct={handleOptimisticDeduct}
                      onUpgradePending={setUpgradePending}
                      anyUpgrading={anyUpgrading}
                    />
                  )
                )}
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

export default Base
