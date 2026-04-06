import { useState } from 'react'
import { useClasses } from '../hooks/useClasses'
import { apiPost } from '../lib/api'
import './Onboarding.css'

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
  const { classes, loading: classesLoading } = useClasses()
  const [heroName, setHeroName] = useState('')
  const [heroClass, setHeroClass] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!heroClass) return setError('Elige una clase para tu héroe.')

    setLoading(true)
    setError(null)

    try {
      await apiPost('/api/onboarding', { heroName, heroClass })
      onComplete()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
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

        {classesLoading ? (
          <p className="ob-loading">Cargando clases...</p>
        ) : (
          <div className="ob-classes">
            {classes?.map(cls => (
              <button
                key={cls.id}
                type="button"
                className={`ob-class-card ${heroClass === cls.id ? 'ob-class-card--selected' : ''}`}
                onClick={() => setHeroClass(cls.id)}
              >
                <span className="ob-class-name">{cls.name}</span>
                <p className="ob-class-desc">{cls.description}</p>
                <div className="ob-class-stats">
                  <StatBar label="FUE" value={cls.strength} />
                  <StatBar label="AGI" value={cls.agility} />
                  <StatBar label="INT" value={cls.intelligence} />
                </div>
              </button>
            ))}
          </div>
        )}

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
