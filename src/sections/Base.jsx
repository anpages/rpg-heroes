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
import './Base.css'

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
    colorBg: '#ecfeff',
    colorBorder: '#a5f3fc',
    effect: (level) => `${level * 30} energía`,
    nextEffect: (level) => `${(level + 1) * 30} energía`,
  },
  gold_mine: {
    name: 'Mina de Oro',
    description: 'Extrae oro de las profundidades de la tierra.',
    icon: Coins,
    color: '#d97706',
    colorBg: '#fffbeb',
    colorBorder: '#fde68a',
    effect: (level) => `${2 + (level - 1)} oro/min`,
    nextEffect: (level) => `${2 + level} oro/min`,
  },
  lumber_mill: {
    name: 'Aserradero',
    description: 'Procesa la madera del bosque cercano.',
    icon: Axe,
    color: '#16a34a',
    colorBg: '#f0fdf4',
    colorBorder: '#bbf7d0',
    effect: (level) => `${1 + (level - 1)} madera/min`,
    nextEffect: (level) => `${1 + level} madera/min`,
  },
  mana_well: {
    name: 'Pozo de Maná',
    description: 'Canaliza energía arcana desde las líneas ley.',
    icon: Sparkles,
    color: '#7c3aed',
    colorBg: '#f5f3ff',
    colorBorder: '#ddd6fe',
    effect: (level) => `${1 + (level - 1)} maná/min`,
    nextEffect: (level) => `${1 + level} maná/min`,
  },
  barracks: {
    name: 'Cuartel',
    description: 'Forja los atributos fundamentales de tu héroe, ampliando su potencial para equipar cartas de habilidad.',
    icon: Swords,
    color: '#dc2626',
    colorBg: '#fef2f2',
    colorBorder: '#fecaca',
    effect: (level) => level === 1 ? 'Sin bonificación' : `+${(level - 1) * 2} fue · +${(level - 1) * 2} agi · +${(level - 1) * 2} int`,
    nextEffect: (level) => `+${level * 2} fue · +${level * 2} agi · +${level * 2} int`,
  },
  workshop: {
    name: 'Taller',
    description: 'Mejora el botín de las expediciones y amplía la capacidad de la mochila.',
    icon: Wrench,
    color: '#0369a1',
    colorBg: '#f0f9ff',
    colorBorder: '#bae6fd',
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
    colorBg: '#fffbeb',
    colorBorder: '#fde68a',
    effect: (level) => level === 1 ? 'Sin descuento' : `-${(level - 1) * 5}% coste de reparación`,
    nextEffect: (level) => `-${level * 5}% coste de reparación`,
  },
  library: {
    name: 'Biblioteca',
    description: 'Custodia las cartas de habilidad. Cada nivel amplía el mazo que puedes equipar.',
    icon: BookOpen,
    color: '#0f766e',
    colorBg: '#f0fdfa',
    colorBorder: '#99f6e4',
    effect: (level) => `${1 + level * 2} cartas equipables`,
    nextEffect: (level) => `${1 + (level + 1) * 2} cartas equipables`,
  },
}

function upgradeCost(level) {
  return {
    gold: Math.round(60 * Math.pow(level, 1.6)),
    wood: Math.round(36 * Math.pow(level, 1.4)),
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

  // Cuando llegan datos reales del servidor, limpiar el optimista
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

  const cost = upgradeCost(level)
  const Icon = meta.icon
  const totalSeconds = level * level * 10 * 60
  const elapsed = hasUpgrade ? totalSeconds - (secondsLeft ?? totalSeconds) : 0
  const pct = hasUpgrade ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  const canAfford = resources && resources.gold >= cost.gold && resources.wood >= cost.wood
  const blockedByOther = !hasUpgrade && anyUpgrading

  async function handleUpgradeStart() {
    const durationMs = building.level * building.level * 10 * 60 * 1000
    setOptimisticEndsAt(new Date(Date.now() + durationMs).toISOString())
    onOptimisticDeduct(cost)
    onUpgradePending(true)  // bloquea todos los demás botones al instante

    try {
      await apiPost('/api/building-upgrade-start', { buildingId: building.id })
      onUpgradePending(false)
      onUpgradeStart()
    } catch (err) {
      setOptimisticEndsAt(null)
      onOptimisticDeduct({ gold: -cost.gold, wood: -cost.wood })
      onUpgradePending(false)
      toast.error(err.message)
    }
  }

  return (
    <div
      className={`building-card ${featured ? 'building-card--featured' : ''}`}
      style={{ '--accent': meta.color }}
    >
      <div className="building-card-top">
        <div className="building-icon-wrap">
          <Icon size={24} strokeWidth={1.8} color={meta.color} />
        </div>
        <div className="building-info">
          <div className="building-name-row">
            <h3 className="building-name">{meta.name}</h3>
            <span className="building-level">Nv. {level}</span>
          </div>
          <p className="building-desc">{meta.description}</p>
          <p className="building-effect">
            {meta.effect(level)}
            {!hasUpgrade && <span className="building-effect-next"> → {meta.nextEffect(level)}</span>}
          </p>
          {nexusRatio !== undefined && nexusRatio < 1 && (
            <p className="building-nexus-penalty">
              ⚡ Energía insuficiente · tasa real reducida al {Math.round(nexusRatio * 100)}%
            </p>
          )}
        </div>
      </div>

      {nexusData && (
        <div className="nexus-panel">
          <div className="nexus-metrics">
            <div className="nexus-metric">
              <span className="nexus-metric-val">{nexusData.produced}</span>
              <span className="nexus-metric-lbl">Producción</span>
            </div>
            <div className="nexus-metric">
              <span className="nexus-metric-val">{nexusData.consumed}</span>
              <span className="nexus-metric-lbl">Consumo</span>
            </div>
            <div className={`nexus-metric nexus-metric--balance ${nexusData.deficit ? 'nexus-metric--deficit' : ''}`}>
              <span className="nexus-metric-val">
                {nexusData.deficit ? `−${Math.abs(nexusData.balance)}` : `+${nexusData.balance}`}
              </span>
              <span className="nexus-metric-lbl">{nexusData.deficit ? `${nexusData.efficiency}% efic.` : 'Excedente'}</span>
            </div>
          </div>
          <div className="nexus-bar-track">
            <div
              className={`nexus-bar-fill ${nexusData.deficit ? 'nexus-bar-fill--deficit' : ''}`}
              style={{ width: `${nexusData.barPct}%` }}
            />
          </div>
        </div>
      )}

      {hasUpgrade && (
        <div className="building-upgrade-progress">
          <div className="building-upgrade-meta">
            <span className="building-upgrade-label">→ Nv. {level + 1}</span>
            <span className="building-upgrade-timer">
              <Clock size={12} strokeWidth={2} />
              {loading ? 'Aplicando...' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
            </span>
          </div>
          <div className="building-upgrade-track">
            <div
              className="building-upgrade-fill"
              style={{
                width: `${pct}%`,
                transition: mountedRef.current ? 'width 1s linear' : 'none',
              }}
            />
          </div>
        </div>
      )}

      {!hasUpgrade && (
        <div className="building-card-bottom">
          <div className="building-costs">
            <span className={`building-cost ${resources?.gold >= cost.gold ? 'building-cost--ok' : 'building-cost--short'}`}>
              <Coins size={12} strokeWidth={2} />
              {fmt(cost.gold)}
            </span>
            <span className={`building-cost ${resources?.wood >= cost.wood ? 'building-cost--ok' : 'building-cost--short'}`}>
              <Axe size={12} strokeWidth={2} />
              {fmt(cost.wood)}
            </span>
          </div>
          <motion.button
            className="btn btn--primary btn--sm"
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


// Requisitos de desbloqueo para mostrar en la UI
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
    <div className="building-card building-card--locked" style={{ '--accent': meta.color }}>
      <div className="building-card-top">
        <div className="building-icon-wrap">
          <Icon size={24} strokeWidth={1.8} color={meta.color} />
        </div>
        <div className="building-info">
          <div className="building-name-row">
            <h3 className="building-name">{meta.name}</h3>
            <Lock size={14} strokeWidth={2.5} className="building-lock-icon" />
          </div>
          <p className="building-desc">{meta.description}</p>
        </div>
      </div>
      <div className="building-lock-req">
        <Lock size={11} strokeWidth={2.5} />
        Requiere {req.name} Nv.{req.level}
      </div>
    </div>
  )
}

const PRODUCTION_TYPES = ['gold_mine', 'lumber_mill', 'mana_well']

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
  }, [building.upgrade_ends_at])

  return { secondsLeft, loading, mountedRef }
}


function Base() {
  const userId      = useAppStore(s => s.userId)
  const queryClient = useQueryClient()
  const { buildings, loading } = useBuildings(userId)
  const { resources } = useResources(userId)
  const [resourceDelta, setResourceDelta] = useState({ gold: 0, wood: 0 })
  const [upgradePending, setUpgradePending] = useState(false)

  // Cuando llegan recursos reales del servidor, resetear el delta
  useEffect(() => { setResourceDelta({ gold: 0, wood: 0 }) }, [resources])

  const effectiveResources = resources
    ? { ...resources, gold: resources.gold - resourceDelta.gold, wood: resources.wood - resourceDelta.wood }
    : null

  function handleOptimisticDeduct({ gold = 0, wood = 0 }) {
    setResourceDelta(d => ({ gold: d.gold + gold, wood: d.wood + wood }))
  }

  function handleUpgradeStart() {
    queryClient.invalidateQueries({ queryKey: queryKeys.buildings(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
  }
  function handleUpgradeCollect() {
    queryClient.invalidateQueries({ queryKey: queryKeys.buildings(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
  }

  if (loading) return <div className="base-loading">Cargando base...</div>

  const byType = Object.fromEntries((buildings ?? []).map(b => [b.type, b]))
  const nexus = byType['energy_nexus']

  const nexusData = nexus ? (() => {
    const allBuildings = Object.values(byType)
    const produced = nexus.level * 30
    // Solo edificios desbloqueados consumen energía
    const consumed = allBuildings.filter(b => PRODUCTION_TYPES.includes(b.type) && b.unlocked !== false).reduce((s, b) => s + b.level * 10, 0)
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
    <div className="base-section">
      <div className="section-header">
        <h2 className="section-title">Base</h2>
        <p className="section-subtitle">Mejora tus edificios para aumentar la producción de recursos y las capacidades de tu héroe.</p>
      </div>

      <motion.div
        className="base-groups"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        {BUILDING_GROUPS.map(group => {
          const groupBuildings = group.types.map(t => byType[t]).filter(Boolean)
          if (!groupBuildings.length) return null
          return (
            <motion.div key={group.id} className="base-group" variants={cardVariants}>
              <p className="base-group-label">{group.label}</p>
              <div className={`base-group-grid base-group-grid--${group.grid}`}>
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
