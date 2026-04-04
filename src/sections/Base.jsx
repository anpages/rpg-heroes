import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useBuildings } from '../hooks/useBuildings'
import { Coins, Axe, Sparkles, Swords, Wrench, Clock, ChevronRight, PackageOpen } from 'lucide-react'
import './Base.css'

const BUILDING_META = {
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
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [canCollect, setCanCollect] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!hasUpgrade) {
      setSecondsLeft(null)
      setCanCollect(false)
      mountedRef.current = false
      return
    }
    const endTime = new Date(building.upgrade_ends_at)
    function tick() {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setSecondsLeft(remaining)
      setCanCollect(remaining === 0)
    }
    tick()
    requestAnimationFrame(() => { mountedRef.current = true })
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [building.upgrade_ends_at, hasUpgrade])

  if (!meta) return null

  const cost = upgradeCost(level)
  const Icon = meta.icon
  const totalSeconds = level * 2 * 60
  const elapsed = hasUpgrade ? totalSeconds - (secondsLeft ?? totalSeconds) : 0
  const pct = hasUpgrade ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  const canAfford = resources && resources.gold >= cost.gold && resources.wood >= cost.wood

  async function handleStart() {
    setLoading(true)
    setError(null)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/building-upgrade-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ buildingId: building.id }),
    })
    const data = await res.json()
    if (res.ok) onUpgradeStart()
    else {
      setError(data.error ?? 'Error al iniciar mejora')
      setLoading(false)
    }
  }

  async function handleCollect() {
    setLoading(true)
    setError(null)
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
      setError(data.error ?? 'Error al recoger mejora')
      setLoading(false)
    }
  }

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
              {canCollect ? 'Completada' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
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
            onClick={handleStart}
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

        {canCollect && (
          <button className="building-collect-btn" onClick={handleCollect} disabled={loading}>
            <PackageOpen size={15} strokeWidth={2} />
            {loading ? 'Recogiendo...' : 'Recoger mejora'}
          </button>
        )}

        {!canCollect && hasUpgrade && <div />}
      </div>

      {error && <p className="building-error">{error}</p>}
    </div>
  )
}

const ORDER = ['gold_mine', 'lumber_mill', 'mana_well', 'barracks', 'workshop']

function Base({ userId, resources }) {
  const { buildings, loading, refetch } = useBuildings(userId)

  function handleUpgradeStart() { refetch() }
  function handleUpgradeCollect() { refetch() }

  if (loading) return <div className="base-loading">Cargando base...</div>

  const sorted = ORDER.map(type => buildings?.find(b => b.type === type)).filter(Boolean)

  return (
    <div className="base-section">
      <div className="section-header">
        <h2 className="section-title">Base</h2>
        <p className="section-subtitle">Mejora tus edificios para aumentar la producción de recursos y las capacidades de tu héroe.</p>
      </div>
      <div className="buildings-grid">
        {sorted.map(b => (
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
