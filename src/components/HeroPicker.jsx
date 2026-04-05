import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus } from 'lucide-react'
import './HeroPicker.css'

// Los colores de estado son CSS vars para adaptarse al tema
const STATUS_COLOR = {
  idle:      '#16a34a',
  exploring: '#d97706',
  resting:   '#60a5fa',  // azul claro visible en ambos temas
  ready:     '#16a34a',
}

const SLOT_UNLOCK = { 2: 5, 3: 10 }

export function RecruitModal({ classes, onRecruit, onClose }) {
  const [name, setName]       = useState('')
  const [classId, setClassId] = useState(classes?.[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/hero-recruit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ heroName: name, heroClass: classId }),
    })
    const data = await res.json()
    if (res.ok) { onRecruit(); onClose() }
    else { setError(data.error ?? 'Error al reclutar'); setLoading(false) }
  }

  return (
    <div className="recruit-overlay" onClick={onClose}>
      <div className="recruit-modal" onClick={e => e.stopPropagation()}>
        <h3 className="recruit-title">Reclutar héroe</h3>
        <form onSubmit={handleSubmit}>
          <div className="recruit-field">
            <label className="recruit-label">Nombre</label>
            <input
              className="recruit-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del héroe"
              maxLength={20}
              autoFocus
              required
            />
          </div>
          <div className="recruit-field">
            <label className="recruit-label">Clase</label>
            <div className="recruit-classes">
              {classes?.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`recruit-class-btn ${classId === c.id ? 'recruit-class-btn--active' : ''}`}
                  onClick={() => setClassId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="recruit-error">{error}</p>}
          <div className="recruit-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Reclutando...' : 'Reclutar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function HeroPicker({ heroes, selectedHeroId, onSelect, onRefetch, showRecruit = false }) {
  const [barrackLevel, setBarrackLevel] = useState(1)
  const [showModal, setShowModal]       = useState(false)
  const [classes, setClasses]           = useState(null)

  useEffect(() => {
    supabase
      .from('buildings')
      .select('level')
      .eq('type', 'barracks')
      .maybeSingle()
      .then(({ data }) => { if (data) setBarrackLevel(data.level) })
  }, [])

  // Siguiente slot disponible para reclutar
  const usedSlots = heroes.map(h => h.slot)
  const nextSlot  = [1, 2, 3].find(s => !usedSlots.includes(s))
  const canRecruit = showRecruit && nextSlot && (!SLOT_UNLOCK[nextSlot] || barrackLevel >= SLOT_UNLOCK[nextSlot])

  // Con un solo héroe y sin posibilidad de reclutar → no renderizar
  if (heroes.length <= 1 && !canRecruit) return null

  async function openRecruit() {
    if (!classes) {
      const { data } = await supabase.from('classes').select('*').order('name')
      setClasses(data ?? [])
    }
    setShowModal(true)
  }

  return (
    <>
      <div className="hero-picker">
        {heroes.map(hero => {
          const active = hero.id === selectedHeroId
          return (
            <button
              key={hero.id}
              className={`hero-tab ${active ? 'hero-tab--active' : ''}`}
              onClick={() => onSelect(hero.id)}
            >
              <span
                className="hero-tab-dot"
                style={{ background: STATUS_COLOR[hero.status] ?? STATUS_COLOR.idle }}
              />
              <span className="hero-tab-name">{hero.name}</span>
              <span className="hero-tab-level">Nv.{hero.level}</span>
            </button>
          )
        })}

        {canRecruit && (
          <button className="hero-tab hero-tab--recruit" onClick={openRecruit}>
            <Plus size={12} strokeWidth={2.5} />
            <span>Reclutar</span>
          </button>
        )}
      </div>

      {showModal && classes && (
        <RecruitModal
          classes={classes}
          onRecruit={onRefetch}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
