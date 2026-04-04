import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, Plus, Swords } from 'lucide-react'
import './HeroPicker.css'

const STATUS_COLOR = {
  idle:      '#16a34a',
  exploring: '#d97706',
  resting:   '#0369a1',
}

const SLOT_UNLOCK = { 2: 5, 3: 10 }

function RecruitModal({ slot, classes, onRecruit, onClose }) {
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
        <h3 className="recruit-title">Reclutar héroe — Slot {slot}</h3>
        <form onSubmit={handleSubmit}>
          <div className="recruit-field">
            <label className="recruit-label">Nombre</label>
            <input
              className="recruit-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del héroe"
              maxLength={20}
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
            <button type="button" className="recruit-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="recruit-submit" disabled={loading}>
              {loading ? 'Reclutando...' : 'Reclutar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function HeroPicker({ heroes, selectedHeroId, onSelect, barrackLevel, onRefetch }) {
  const [recruitSlot, setRecruitSlot] = useState(null)
  const [classes, setClasses]         = useState(null)

  async function openRecruit(slot) {
    if (!classes) {
      const { data } = await supabase.from('classes').select('*').order('name')
      setClasses(data ?? [])
    }
    setRecruitSlot(slot)
  }

  const slots = [1, 2, 3]

  return (
    <div className="hero-picker">
      {slots.map(slot => {
        const hero    = heroes.find(h => h.slot === slot)
        const required = SLOT_UNLOCK[slot]
        const locked  = required && (barrackLevel ?? 1) < required

        if (hero) {
          const active = hero.id === selectedHeroId
          return (
            <button
              key={slot}
              className={`hero-picker-slot ${active ? 'hero-picker-slot--active' : ''}`}
              onClick={() => onSelect(hero.id)}
            >
              <div className="hero-picker-avatar">
                <Swords size={14} strokeWidth={1.8} />
              </div>
              <div className="hero-picker-info">
                <span className="hero-picker-name">{hero.name}</span>
                <span className="hero-picker-meta">Nv.{hero.level} · {hero.classes?.name ?? ''}</span>
              </div>
              <span
                className="hero-picker-status"
                style={{ background: STATUS_COLOR[hero.status] ?? STATUS_COLOR.idle }}
                title={hero.status}
              />
            </button>
          )
        }

        if (locked) {
          return (
            <div key={slot} className="hero-picker-slot hero-picker-slot--locked">
              <Lock size={13} color="var(--text-3)" strokeWidth={2} />
              <span className="hero-picker-locked-label">Cuartel Nv.{required}</span>
            </div>
          )
        }

        return (
          <button key={slot} className="hero-picker-slot hero-picker-slot--empty" onClick={() => openRecruit(slot)}>
            <Plus size={14} strokeWidth={2} color="var(--text-3)" />
            <span className="hero-picker-locked-label">Reclutar</span>
          </button>
        )
      })}

      {recruitSlot && (
        <RecruitModal
          slot={recruitSlot}
          classes={classes}
          onRecruit={onRefetch}
          onClose={() => setRecruitSlot(null)}
        />
      )}
    </div>
  )
}
