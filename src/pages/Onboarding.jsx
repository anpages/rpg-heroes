import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Onboarding.css'

const CLASSES = [
  {
    id: 'caudillo',
    name: 'Caudillo',
    description: 'Guerrero implacable que aplasta a sus enemigos con fuerza bruta y voluntad de hierro.',
    stats: { str: 16, agi: 10, int: 5 },
  },
  {
    id: 'arcanista',
    name: 'Arcanista',
    description: 'Canalizador de energías primordiales. Destruye hordas enteras, pero su cuerpo es frágil como el cristal.',
    stats: { str: 5, agi: 8, int: 18 },
  },
  {
    id: 'segador',
    name: 'Segador',
    description: 'Maestro de la muerte y las maldiciones. Sus ejércitos de muertos combaten por él.',
    stats: { str: 8, agi: 7, int: 15 },
  },
  {
    id: 'sombra',
    name: 'Sombra',
    description: 'Cazador veloz que actúa desde la oscuridad. Golpea primero, desaparece después.',
    stats: { str: 8, agi: 18, int: 8 },
  },
  {
    id: 'domador',
    name: 'Domador',
    description: 'Vínculo entre lo salvaje y lo humano. Combate junto a sus bestias, equilibrado y resistente.',
    stats: { str: 10, agi: 10, int: 12 },
  },
]

const MAX_STAT = 18

function StatBar({ label, value }) {
  const pct = Math.round((value / MAX_STAT) * 100)
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <div className="stat-track">
        <div className="stat-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="stat-value">{value}</span>
    </div>
  )
}

function Onboarding({ session, onComplete }) {
  const [heroName, setHeroName] = useState('')
  const [heroClass, setHeroClass] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!heroClass) return setError('Elige una clase para tu héroe.')

    setLoading(true)
    setError(null)

    const { data: { session: currentSession } } = await supabase.auth.getSession()
    const token = currentSession?.access_token

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ heroName, heroClass }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error desconocido.')
      setLoading(false)
      return
    }

    onComplete()
  }

  return (
    <div className="ob-root">
      <div className="ob-bg-glow" />

      <form className="ob-panel" onSubmit={handleSubmit} noValidate>
        <div className="ob-header">
          <p className="ob-eyebrow">Bienvenido al reino</p>
          <h1 className="ob-title">Crea tu Héroe</h1>
        </div>

        <div className="ob-divider">
          <div className="ob-divider-line" />
          <div className="ob-divider-diamond" />
          <div className="ob-divider-line" />
        </div>

        {/* Name */}
        <div className="ob-field">
          <label className="ob-label" htmlFor="hero-name">Nombre del héroe</label>
          <input
            id="hero-name"
            className="ob-input"
            type="text"
            value={heroName}
            onChange={e => setHeroName(e.target.value)}
            placeholder="Escribe un nombre..."
            maxLength={20}
            required
            autoComplete="off"
          />
        </div>

        {/* Class selection */}
        <div className="ob-classes-label">
          <span className="ob-label">Elige tu clase</span>
        </div>
        <div className="ob-classes">
          {CLASSES.map(cls => (
            <button
              key={cls.id}
              type="button"
              className={`ob-class-card ${heroClass === cls.id ? 'ob-class-card--selected' : ''}`}
              onClick={() => setHeroClass(cls.id)}
            >
              <span className="ob-class-name">{cls.name}</span>
              <p className="ob-class-desc">{cls.description}</p>
              <div className="ob-class-stats">
                <StatBar label="FUE" value={cls.stats.str} />
                <StatBar label="AGI" value={cls.stats.agi} />
                <StatBar label="INT" value={cls.stats.int} />
              </div>
            </button>
          ))}
        </div>

        {error && <p className="ob-error">{error}</p>}

        <button
          type="submit"
          className="ob-submit"
          disabled={loading || !heroName.trim() || !heroClass}
        >
          {loading ? 'Forjando tu leyenda...' : 'Comenzar la aventura'}
        </button>
      </form>
    </div>
  )
}

export default Onboarding
