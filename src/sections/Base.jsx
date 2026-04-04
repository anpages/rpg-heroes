import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useBuildings } from '../hooks/useBuildings'
import { Coins, Axe, Sparkles, Swords, Wrench, Clock, ChevronRight, Zap } from 'lucide-react'
import './Base.css'

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
    effect: (level) => `${10 + (level - 1) * 5} oro/min`,
    nextEffect: (level) => `${10 + level * 5} oro/min`,
  },
  lumber_mill: {
    name: 'Aserradero',
    description: 'Procesa la madera del bosque cercano.',
    icon: Axe,
    color: '#16a34a',
    colorBg: '#f0fdf4',
    colorBorder: '#bbf7d0',
    effect: (level) => `${6 + (level - 1) * 3} madera/min`,
    nextEffect: (level) => `${6 + level * 3} madera/min`,
  },
  mana_well: {
    name: 'Pozo de Maná',
    description: 'Canaliza energía arcana desde las líneas ley.',
    icon: Sparkles,
    color: '#7c3aed',
    colorBg: '#f5f3ff',
    colorBorder: '#ddd6fe',
    effect: (level) => `${2 + (level - 1)} maná/min`,
    nextEffect: (level) => `${2 + level} maná/min`,
  },
  barracks: {
    name: 'Cuartel',
    description: 'Entrena y fortalece las capacidades de tu héroe.',
    icon: Swords,
    color: '#dc2626',
    colorBg: '#fef2f2',
    colorBorder: '#fecaca',
    effect: (level) => level === 1 ? 'Sin bonificación' : `+${(level - 1) * 2} atq · +${level - 1} def · +${(level - 1) * 5} hp`,
    nextEffect: (level) => `+${level * 2} atq · +${level} def · +${level * 5} hp`,
  },
  workshop: {
    name: 'Taller',
    description: 'Fabrica equipamiento y optimiza las expediciones.',
    icon: Wrench,
    color: '#0369a1',
    colorBg: '#f0f9ff',
    colorBorder: '#bae6fd',
    effect: (level) => level === 1 ? 'Sin bonificación' : `-${(level - 1) * 5}% duración`,
    nextEffect: (level) => `-${level * 5}% duración`,
  },
}

function upgradeCost(level) {
  return {
    gold: Math.round(100 * Math.pow(level, 1.6)),
    wood: Math.round(60 * Math.pow(level, 1.4)),
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

function BuildingCard({ building, resources, onUpgradeStart, onUpgradeCollect }) {
  const meta = BUILDING_META[building.type]
  const { level } = building
  const hasUpgrade = !!building.upgrade_ends_at
  const { secondsLeft, loading, error, setLoading, setError, mountedRef } = useUpgradeTimer(building, onUpgradeCollect)

  if (!meta) return null

  const cost = upgradeCost(level)
  const Icon = meta.icon
  const totalSeconds = level * 2 * 60
  const elapsed = hasUpgrade ? totalSeconds - (secondsLeft ?? totalSeconds) : 0
  const pct = hasUpgrade ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  const canAfford = resources && resources.gold >= cost.gold && resources.wood >= cost.wood

  return (
    <div
      className="building-card"
      style={{ '--accent': meta.color, '--accent-bg': meta.colorBg, '--accent-border': meta.colorBorder }}
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
          <p className="building-effect">{meta.effect(level)}</p>
        </div>
      </div>

      {hasUpgrade && (
        <div className="building-upgrade-progress">
          <div className="building-upgrade-bar-wrap">
            <div className="building-upgrade-track">
              <div
                className="building-upgrade-fill"
                style={{
                  width: `${pct}%`,
                  transition: mountedRef.current ? 'width 1s linear' : 'none',
                }}
              />
            </div>
            <span className="building-upgrade-pct">{pct}%</span>
          </div>
          <div className="building-upgrade-meta">
            <span className="building-upgrade-label">
              Mejorando a Nv. {level + 1} · {meta.nextEffect(level)}
            </span>
            <span className="building-upgrade-timer">
              <Clock size={12} strokeWidth={2} />
              {loading ? 'Aplicando...' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
            </span>
          </div>
        </div>
      )}

      <div className="building-card-bottom">
        {!hasUpgrade && (
          <span className="building-next-effect">
            Próximo nivel: {meta.nextEffect(level)}
          </span>
        )}

        {!hasUpgrade && (
          <button
            className={`building-upgrade-btn ${!canAfford ? 'building-upgrade-btn--cant-afford' : ''}`}
            onClick={() => startUpgrade(building.id, setLoading, setError, onUpgradeStart)}
            disabled={loading || !canAfford}
          >
            {loading
              ? 'Iniciando...'
              : <>
                  <span>Mejorar</span>
                  <span className="upgrade-cost">
                    <Coins size={12} strokeWidth={2} />{fmt(cost.gold)}
                    <Axe size={12} strokeWidth={2} />{fmt(cost.wood)}
                  </span>
                </>
            }
          </button>
        )}

        {hasUpgrade && <div />}
      </div>

      {error && <p className="building-error">{error}</p>}
    </div>
  )
}


const ORDER = ['energy_nexus', 'gold_mine', 'lumber_mill', 'mana_well', 'barracks', 'workshop']
const PRODUCTION_TYPES = ['gold_mine', 'lumber_mill', 'mana_well']

function useUpgradeTimer(building, onUpgradeCollect) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(false)
  const collectingRef = useRef(false)

  useEffect(() => {
    const hasUpgrade = !!building.upgrade_ends_at
    if (!hasUpgrade) {
      setSecondsLeft(null)
      mountedRef.current = false
      collectingRef.current = false
      return
    }
    const endTime = new Date(building.upgrade_ends_at)

    async function autoCollect() {
      if (collectingRef.current) return
      collectingRef.current = true
      setLoading(true)
      await supabase.auth.refreshSession()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/building-upgrade-collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ buildingId: building.id }),
      })
      const data = await res.json()
      if (res.ok) onUpgradeCollect()
      else {
        setError(data.error ?? 'Error al aplicar mejora')
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

  return { secondsLeft, loading, error, setLoading, setError, mountedRef }
}

async function startUpgrade(buildingId, setLoading, setError, onUpgradeStart) {
  setLoading(true)
  setError(null)
  await supabase.auth.refreshSession()
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/building-upgrade-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ buildingId }),
  })
  const data = await res.json()
  if (res.ok) onUpgradeStart()
  else {
    setError(data.error ?? 'Error al iniciar mejora')
    setLoading(false)
  }
}

function NexoCard({ building, buildings, resources, onUpgradeStart, onUpgradeCollect }) {
  const { level } = building
  const hasUpgrade = !!building.upgrade_ends_at
  const { secondsLeft, loading, error, setLoading, setError, mountedRef } = useUpgradeTimer(building, onUpgradeCollect)

  const energyProduced = level * 30
  const energyConsumed = buildings
    .filter(b => PRODUCTION_TYPES.includes(b.type))
    .reduce((sum, b) => sum + b.level * 10, 0)
  const balance = energyProduced - energyConsumed
  const deficit = balance < 0
  const efficiency = energyConsumed > 0 ? Math.min(100, Math.round((energyProduced / energyConsumed) * 100)) : 100
  const barPct = energyConsumed > 0 ? Math.min(100, Math.round((energyProduced / energyConsumed) * 100)) : 100

  const cost = upgradeCost(level)
  const canAfford = resources && resources.gold >= cost.gold && resources.wood >= cost.wood

  const totalSeconds = level * 2 * 60
  const elapsed = hasUpgrade ? totalSeconds - (secondsLeft ?? totalSeconds) : 0
  const upgradePct = hasUpgrade ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  return (
    <div className={`nexo-card ${deficit ? 'nexo-card--deficit' : ''}`}>
      <div className="nexo-top">
        <div className="nexo-identity">
          <div className="nexo-icon-wrap">
            <Zap size={28} strokeWidth={1.8} />
          </div>
          <div className="nexo-info">
            <div className="nexo-name-row">
              <h3 className="nexo-name">Nexo Arcano</h3>
              <span className="nexo-level">Nv. {level}</span>
            </div>
            <p className="nexo-desc">Fuente de energía de la base. Sin ella, la producción se detiene.</p>
          </div>
        </div>

        <div className="nexo-energy">
          <div className="nexo-energy-stats">
            <div className="nexo-energy-stat">
              <span className="nexo-energy-value">{energyProduced}</span>
              <span className="nexo-energy-label">producida</span>
            </div>
            <div className="nexo-energy-sep">/</div>
            <div className="nexo-energy-stat">
              <span className="nexo-energy-value">{energyConsumed}</span>
              <span className="nexo-energy-label">consumida</span>
            </div>
          </div>
          <div className="nexo-energy-track">
            <div
              className={`nexo-energy-fill ${deficit ? 'nexo-energy-fill--deficit' : ''}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <p className={`nexo-energy-status ${deficit ? 'nexo-energy-status--deficit' : 'nexo-energy-status--ok'}`}>
            {deficit ? `Déficit — producción al ${efficiency}%` : `+${balance} excedente`}
          </p>
        </div>
      </div>

      {hasUpgrade && (
        <div className="building-upgrade-progress">
          <div className="building-upgrade-bar-wrap">
            <div className="building-upgrade-track">
              <div
                className="building-upgrade-fill"
                style={{ width: `${upgradePct}%`, transition: mountedRef.current ? 'width 1s linear' : 'none' }}
              />
            </div>
            <span className="building-upgrade-pct">{upgradePct}%</span>
          </div>
          <div className="building-upgrade-meta">
            <span className="building-upgrade-label">
              Mejorando a Nv. {level + 1} · {(level + 1) * 30} energía
            </span>
            <span className="building-upgrade-timer">
              <Clock size={12} strokeWidth={2} />
              {loading ? 'Aplicando...' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
            </span>
          </div>
        </div>
      )}

      {!hasUpgrade && (
        <div className="nexo-bottom">
          <span className="building-next-effect">Próximo nivel: {(level + 1) * 30} energía</span>
          <button
            className={`building-upgrade-btn ${!canAfford ? 'building-upgrade-btn--cant-afford' : ''}`}
            onClick={() => startUpgrade(building.id, setLoading, setError, onUpgradeStart)}
            disabled={loading || !canAfford}
          >
            {loading
              ? 'Iniciando...'
              : <><span>Mejorar</span><span className="upgrade-cost"><Coins size={12} strokeWidth={2} />{fmt(cost.gold)}<Axe size={12} strokeWidth={2} />{fmt(cost.wood)}</span></>
            }
          </button>
        </div>
      )}

      {error && <p className="building-error">{error}</p>}
    </div>
  )
}

function Base({ userId, resources }) {
  const { buildings, loading, refetch } = useBuildings(userId)

  function handleUpgradeStart() { refetch() }
  function handleUpgradeCollect() { refetch() }

  if (loading) return <div className="base-loading">Cargando base...</div>

  const sorted = ORDER.map(type => buildings?.find(b => b.type === type)).filter(Boolean)
  const nexus = sorted.find(b => b.type === 'energy_nexus')
  const rest = sorted.filter(b => b.type !== 'energy_nexus')

  return (
    <div className="base-section">
      <div className="section-header">
        <h2 className="section-title">Base</h2>
        <p className="section-subtitle">Mejora tus edificios para aumentar la producción de recursos y las capacidades de tu héroe.</p>
      </div>
      {nexus && (
        <NexoCard
          building={nexus}
          buildings={sorted}
          resources={resources}
          onUpgradeStart={handleUpgradeStart}
          onUpgradeCollect={handleUpgradeCollect}
        />
      )}
      <div className="buildings-grid">
        {rest.map(b => (
          <BuildingCard
            key={b.id}
            building={b}
            resources={resources}
            onUpgradeStart={handleUpgradeStart}
            onUpgradeCollect={handleUpgradeCollect}
          />
        ))}
      </div>
    </div>
  )
}

export default Base
