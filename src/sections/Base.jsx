import { useBuildings } from '../hooks/useBuildings'
import { Coins, Axe, Sparkles, Swords, Wrench } from 'lucide-react'
import './Base.css'

const BUILDING_META = {
  gold_mine: {
    name: 'Mina de Oro',
    description: 'Extrae oro de las profundidades de la tierra.',
    resource: 'Oro',
    icon: Coins,
    color: '#d97706',
    colorBg: '#fffbeb',
    colorBorder: '#fde68a',
  },
  lumber_mill: {
    name: 'Aserradero',
    description: 'Procesa la madera del bosque cercano.',
    resource: 'Madera',
    icon: Axe,
    color: '#16a34a',
    colorBg: '#f0fdf4',
    colorBorder: '#bbf7d0',
  },
  mana_well: {
    name: 'Pozo de Maná',
    description: 'Canaliza energía arcana desde las líneas ley.',
    resource: 'Maná',
    icon: Sparkles,
    color: '#7c3aed',
    colorBg: '#f5f3ff',
    colorBorder: '#ddd6fe',
  },
  barracks: {
    name: 'Cuartel',
    description: 'Entrena y fortalece las capacidades de tu héroe.',
    resource: 'Combate',
    icon: Swords,
    color: '#dc2626',
    colorBg: '#fef2f2',
    colorBorder: '#fecaca',
  },
  workshop: {
    name: 'Taller',
    description: 'Fabrica equipamiento y mejoras para la expedición.',
    resource: 'Equipo',
    icon: Wrench,
    color: '#0369a1',
    colorBg: '#f0f9ff',
    colorBorder: '#bae6fd',
  },
}

// Coste de mejora: 100 * nivel^1.6 (redondeado)
function upgradeCost(level) {
  return {
    gold: Math.round(100 * Math.pow(level, 1.6)),
    wood: Math.round(60  * Math.pow(level, 1.4)),
  }
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function BuildingCard({ building }) {
  const meta = BUILDING_META[building.type]
  if (!meta) return null

  const { level } = building
  const cost = upgradeCost(level)
  const Icon = meta.icon
  const isUpgrading = !!building.upgrade_ends_at && new Date(building.upgrade_ends_at) > new Date()

  return (
    <div className="building-card" style={{ '--accent': meta.color, '--accent-bg': meta.colorBg, '--accent-border': meta.colorBorder }}>
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
        </div>
      </div>

      <div className="building-card-bottom">
        <div className="building-resource-tag">
          <span>{meta.resource}</span>
        </div>
        <button className="building-upgrade-btn" disabled>
          {isUpgrading
            ? 'Mejorando...'
            : <><span>Mejorar</span><span className="upgrade-cost"><Coins size={12} strokeWidth={2} />{fmt(cost.gold)} · <Axe size={12} strokeWidth={2} />{fmt(cost.wood)}</span></>
          }
        </button>
      </div>
    </div>
  )
}

function Base({ userId }) {
  const { buildings, loading } = useBuildings(userId)

  if (loading) return <div className="base-loading">Cargando base...</div>

  // Ordenar por tipo para mostrar siempre en el mismo orden
  const ORDER = ['gold_mine', 'lumber_mill', 'mana_well', 'barracks', 'workshop']
  const sorted = ORDER.map(type => buildings?.find(b => b.type === type)).filter(Boolean)

  return (
    <div className="base-section">
      <div className="section-header">
        <h2 className="section-title">Base</h2>
        <p className="section-subtitle">Mejora tus edificios para aumentar la producción de recursos y las capacidades de tu héroe.</p>
      </div>
      <div className="buildings-grid">
        {sorted.map(b => (
          <BuildingCard key={b.id} building={b} />
        ))}
      </div>
    </div>
  )
}

export default Base
