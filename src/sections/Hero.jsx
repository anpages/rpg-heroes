import { useHero } from '../hooks/useHero'
import { Sword, Shield, Heart, Dumbbell, Wind, Sparkles, Brain, CircleDot } from 'lucide-react'
import './Hero.css'

const STATUS_META = {
  idle:      { label: 'En reposo',    color: '#16a34a' },
  exploring: { label: 'Explorando',   color: '#d97706' },
  resting:   { label: 'Recuperando',  color: '#0369a1' },
}

// XP necesaria para subir del nivel actual al siguiente
function xpForNextLevel(level) {
  return level * 150
}

function XpBar({ level, experience }) {
  const needed = xpForNextLevel(level)
  const pct = Math.min(100, Math.round((experience / needed) * 100))
  return (
    <div className="xp-bar-wrap">
      <div className="xp-bar-labels">
        <span>Nivel {level}</span>
        <span>{experience} / {needed} XP</span>
      </div>
      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StatRow({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-row">
      <div className="stat-icon" style={{ color }}>
        <Icon size={16} strokeWidth={1.8} />
      </div>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

function HpBar({ current, max }) {
  const pct = Math.min(100, Math.round((current / max) * 100))
  const color = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  return (
    <div className="hp-bar-wrap">
      <div className="hp-bar-labels">
        <span className="hp-label"><Heart size={13} strokeWidth={2} color={color} /> HP</span>
        <span className="hp-value">{current} / {max}</span>
      </div>
      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function Hero({ userId }) {
  const { hero, loading } = useHero(userId)

  if (loading) return <div className="hero-loading">Cargando héroe...</div>
  if (!hero) return <div className="hero-loading">No se encontró el héroe.</div>

  const cls = hero.classes
  const status = STATUS_META[hero.status] ?? STATUS_META.idle

  return (
    <div className="hero-section">
      <div className="section-header">
        <h2 className="section-title">Héroe</h2>
        <p className="section-subtitle">Estadísticas y estado actual de tu héroe.</p>
      </div>

      <div className="hero-card">

        {/* Header del héroe */}
        <div className="hero-card-header">
          <div className="hero-avatar">
            <Sword size={32} strokeWidth={1.5} color={cls?.color} />
          </div>
          <div className="hero-identity">
            <h3 className="hero-name">{hero.name}</h3>
            <div className="hero-badges">
              <span className="hero-class-badge" style={{ color: cls?.color, background: cls?.bg_color, borderColor: cls?.border_color }}>
                {cls?.name}
              </span>
              <span className="hero-status-badge" style={{ color: status.color }}>
                <CircleDot size={10} strokeWidth={2.5} />
                {status.label}
              </span>
            </div>
          </div>
        </div>

        {/* Barra de XP */}
        <XpBar level={hero.level} experience={hero.experience} />

        {/* Barra de HP */}
        <HpBar current={hero.current_hp} max={hero.max_hp} />

        {/* Stats */}
        <div className="hero-stats-grid">
          <div className="hero-stats-group">
            <p className="stats-group-title">Atributos</p>
            <StatRow icon={Dumbbell} label="Fuerza"       value={hero.strength}     color="#dc2626" />
            <StatRow icon={Wind}     label="Agilidad"     value={hero.agility}      color="#0369a1" />
            <StatRow icon={Brain}    label="Inteligencia" value={hero.intelligence} color="#7c3aed" />
          </div>
          <div className="hero-stats-group">
            <p className="stats-group-title">Combate</p>
            <StatRow icon={Sword}  label="Ataque"  value={hero.attack}  color="#d97706" />
            <StatRow icon={Shield} label="Defensa" value={hero.defense} color="#475569" />
          </div>
        </div>

      </div>
    </div>
  )
}

export default Hero
