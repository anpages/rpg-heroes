import { useState } from 'react'
import { useClasses } from '../hooks/useClasses'
import { apiPost } from '../lib/api'
import { supabase } from '../lib/supabase'
import { LogOut } from 'lucide-react'

const MAX_STAT = 18

function StatBar({ label, value, selected }) {
  const pct = Math.round((value / MAX_STAT) * 100)
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold tracking-[0.05em] text-text-3 w-[22px] flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-border rounded-[4px] overflow-hidden">
        <div
          className={`h-full rounded-[4px] transition-[width] duration-300 ease-out ${selected ? 'bg-btn-primary' : 'bg-[var(--blue-400)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-text-3 w-3.5 text-right flex-shrink-0">{value}</span>
    </div>
  )
}

function Onboarding({ onComplete }) {
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
    <div className="min-h-screen flex items-start justify-center bg-bg px-5 pt-12 pb-16">
      <button
        type="button"
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface text-text-2 text-[13px] font-medium hover:text-text hover:border-border-2 transition-colors"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut size={14} strokeWidth={2} />
        Cambiar cuenta
      </button>
      <form
        className="relative z-10 w-[min(900px,100%)] bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] px-5 py-7 sm:px-11 sm:pt-10 sm:pb-12"
        onSubmit={handleSubmit}
        noValidate
      >
        {/* Header */}
        <div className="text-center mb-5">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--blue-500)] mb-2">
            Bienvenido al reino
          </p>
          <h1 className="font-display text-[clamp(30px,5vw,44px)] font-normal tracking-[0.05em] text-[var(--blue-700)] leading-none">
            Crea tu Héroe
          </h1>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="flex-1 h-px bg-border" />
          <div className="w-1.5 h-1.5 bg-[var(--blue-400)] rotate-45 flex-shrink-0" />
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Nombre */}
        <div className="mb-7">
          <label className="block text-[12px] font-semibold tracking-[0.08em] uppercase text-text-2 mb-2" htmlFor="hero-name">
            Nombre del héroe
          </label>
          <input
            id="hero-name"
            className="w-full px-3.5 py-[11px] bg-surface-2 border-[1.5px] border-border rounded-lg text-text font-[inherit] text-[16px] outline-none transition-[border-color,box-shadow,background] duration-200 placeholder:text-text-3 focus:border-[var(--blue-500)] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus:bg-surface"
            type="text"
            value={heroName}
            onChange={e => setHeroName(e.target.value)}
            placeholder="Escribe un nombre..."
            maxLength={20}
            required
            autoComplete="off"
          />
        </div>

        {/* Clase */}
        <div className="mb-7">
          <div className="mb-3">
            <span className="block text-[12px] font-semibold tracking-[0.08em] uppercase text-text-2">Elige tu clase</span>
          </div>

          {classesLoading ? (
            <p className="text-text-3 text-[14px] text-center py-5 italic">Cargando clases...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-3">
              {classes?.map(cls => {
                const selected = heroClass === cls.id
                return (
                  <button
                    key={cls.id}
                    type="button"
                    className={`relative flex flex-col items-start px-3.5 py-3 border-[1.5px] rounded-[10px] text-text text-left cursor-pointer transition-[border-color,background,box-shadow] duration-200
                      ${selected
                        ? 'border-[var(--blue-500)] bg-[var(--blue-50)] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
                        : 'bg-surface-2 border-border hover:border-[var(--blue-400)] hover:bg-[var(--blue-50)]'
                      }`}
                    onClick={() => setHeroClass(cls.id)}
                  >
                    {selected && (
                      <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[var(--blue-500)]" />
                    )}
                    <span className={`text-[14px] font-bold mb-2 block ${selected ? 'text-[var(--blue-700)]' : 'text-text'}`}>
                      {cls.name}
                    </span>
                    <div className="w-full flex flex-col gap-[5px]">
                      <StatBar label="FUE" value={cls.strength}     selected={selected} />
                      <StatBar label="AGI" value={cls.agility}      selected={selected} />
                      <StatBar label="INT" value={cls.intelligence} selected={selected} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="text-[14px] text-[#dc2626] mb-4 text-center">{error}</p>
        )}

        <button
          type="submit"
          className="w-full px-6 py-[13px] bg-btn-primary border-0 rounded-[10px] text-white font-[inherit] text-[15px] font-semibold tracking-[0.01em] transition-[background,box-shadow,transform] duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:bg-btn-primary-hover hover:not-disabled:shadow-[0_4px_16px_rgba(37,99,235,0.35)] active:not-disabled:translate-y-px active:not-disabled:shadow-none"
          disabled={loading || !heroName.trim() || !heroClass}
        >
          {loading ? 'Forjando tu leyenda...' : 'Comenzar la aventura'}
        </button>
      </form>
    </div>
  )
}

export default Onboarding
