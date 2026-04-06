import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { Lock, Plus, ChevronDown } from 'lucide-react'

const SLOT_UNLOCK      = { 2: 5, 3: 10 }
const STATUS_COLOR     = { idle: '#16a34a', exploring: '#d97706', ready: '#16a34a' }
const STATUS_LABEL     = { idle: 'Reposo', exploring: 'Explorando', ready: 'Lista ✓' }

function getDerivedStatus(hero) {
  if (hero.status === 'exploring') {
    const active = hero.expeditions?.find(e => e.status === 'traveling')
    if (active && new Date(active.ends_at) <= new Date()) return 'ready'
  }
  return hero.status
}

/**
 * Selector de héroe inline.
 * variant="pills"   (defecto) — fila de pills, ideal para el tab Héroes
 * variant="compact" — dropdown de una línea, ideal para Mundo/mobile
 * Se oculta si el jugador tiene 1 héroe sin slots futuros.
 */
export function HeroSelector({ variant = 'pills' }) {
  const userId            = useAppStore(s => s.userId)
  const selectedHeroId    = useAppStore(s => s.selectedHeroId)
  const setSelectedHeroId = useAppStore(s => s.setSelectedHeroId)
  const setRecruitOpen    = useAppStore(s => s.setRecruitOpen)

  const { heroes }    = useHeroes(userId)
  const { buildings } = useBuildings(userId)

  const barrackLevel = (buildings ?? []).find(b => b.type === 'barracks')?.level ?? 1
  const usedSlots    = heroes.map(h => h.slot ?? 1)
  const nextSlot     = [1, 2, 3].find(s => !usedSlots.includes(s))
  const canRecruit   = !!(nextSlot && (!SLOT_UNLOCK[nextSlot] || barrackLevel >= SLOT_UNLOCK[nextSlot]))
  const lockedSlots  = [2, 3].filter(slot => {
    const filled   = heroes.some(h => h.slot === slot)
    const unlocked = !SLOT_UNLOCK[slot] || barrackLevel >= SLOT_UNLOCK[slot]
    return !filled && !unlocked
  })

  if (heroes.length <= 1 && !canRecruit && lockedSlots.length === 0) return null

  const heroId      = selectedHeroId ?? heroes?.[0]?.id ?? null
  const activeHero  = heroes.find(h => h.id === heroId) ?? heroes[0]

  if (variant === 'compact') {
    return <HeroDropdown heroes={heroes} heroId={heroId} activeHero={activeHero} onSelect={setSelectedHeroId} onRecruit={canRecruit ? () => setRecruitOpen(true) : null} />
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {heroes.map(hero => {
        const status   = getDerivedStatus(hero)
        const isActive = hero.id === heroId
        const isReady  = status === 'ready'
        return (
          <button
            key={hero.id}
            className={`flex items-center gap-1.5 px-3 py-[6px] rounded-lg border text-[13px] font-semibold transition-[background,border-color,color] duration-150 whitespace-nowrap font-[inherit] cursor-pointer
              ${isReady
                ? 'bg-[color-mix(in_srgb,#16a34a_10%,var(--surface-2))] border-[color-mix(in_srgb,#16a34a_35%,var(--border))] text-[#15803d]'
                : isActive
                  ? 'bg-info-bg border-[var(--blue-200)] text-[var(--blue-700)]'
                  : 'border-border bg-surface-2 text-text-2 hover:border-border-2 hover:text-text'
              }`}
            onClick={() => setSelectedHeroId(hero.id)}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[status] ?? STATUS_COLOR.idle }} />
            {hero.name}
            <span className="text-[11px] font-medium opacity-70">Nv.{hero.level}</span>
            <span className="hidden sm:inline text-[11px] font-normal opacity-60 border-l border-current/20 pl-1.5 ml-0.5">
              {STATUS_LABEL[status] ?? 'Reposo'}
            </span>
          </button>
        )
      })}
      {canRecruit && (
        <button className="btn btn--ghost btn--sm border-dashed" onClick={() => setRecruitOpen(true)}>
          <Plus size={12} strokeWidth={2.5} /> Reclutar
        </button>
      )}
      {lockedSlots.map(slot => (
        <div
          key={`locked-${slot}`}
          className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg border border-dashed border-border opacity-45 whitespace-nowrap select-none text-[13px]"
          title={`Desbloquea con Cuartel Nv.${SLOT_UNLOCK[slot]}`}
        >
          <Lock size={11} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
          <span className="text-[12px] font-semibold text-text-3">Héroe {slot}</span>
          <span className="hidden sm:inline text-[11px] text-text-3">· Cuartel Nv.{SLOT_UNLOCK[slot]}</span>
        </div>
      ))}
    </div>
  )
}

function HeroDropdown({ heroes, heroId, activeHero, onSelect, onRecruit }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const status  = activeHero ? getDerivedStatus(activeHero) : 'idle'
  const isReady = status === 'ready'

  return (
    <div ref={ref} className="relative inline-block">
      <button
        className={`flex items-center gap-2 px-3 py-[7px] rounded-lg border text-[13px] font-semibold transition-[background,border-color,color] duration-150 font-[inherit] cursor-pointer
          ${isReady
            ? 'bg-[color-mix(in_srgb,#16a34a_8%,var(--surface))] border-[color-mix(in_srgb,#16a34a_30%,var(--border))] text-[#15803d]'
            : 'bg-surface border-border text-text hover:border-[var(--blue-200)] hover:bg-info-bg'
          }`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[status] ?? STATUS_COLOR.idle }} />
        <span>{activeHero?.name ?? '—'}</span>
        <span className="text-[11px] font-medium text-text-3">Nv.{activeHero?.level}</span>
        <span className="text-[11px] text-text-3 hidden sm:inline border-l border-border pl-2 ml-0.5">{STATUS_LABEL[status] ?? 'Reposo'}</span>
        <ChevronDown size={13} strokeWidth={2.5} className={`text-text-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-surface border border-border rounded-[10px] shadow-[var(--shadow-md)] z-50 py-1 overflow-hidden">
          {heroes.map(hero => {
            const s        = getDerivedStatus(hero)
            const isActive = hero.id === heroId
            return (
              <button
                key={hero.id}
                className={`flex items-center gap-2 w-full px-3 py-2 text-[13px] font-semibold text-left transition-[background,color] duration-100 font-[inherit] cursor-pointer
                  ${isActive ? 'bg-info-bg text-[var(--blue-700)]' : 'text-text hover:bg-surface-2'}`}
                onClick={() => { onSelect(hero.id); setOpen(false) }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR[s] ?? STATUS_COLOR.idle }} />
                {hero.name}
                <span className="text-[11px] font-normal text-text-3 ml-auto">Nv.{hero.level}</span>
              </button>
            )
          })}
          {onRecruit && (
            <>
              <div className="h-px bg-border mx-2 my-1" />
              <button
                className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-semibold text-text-3 hover:bg-surface-2 transition-[background] duration-100 font-[inherit] cursor-pointer"
                onClick={() => { onRecruit(); setOpen(false) }}
              >
                <Plus size={13} strokeWidth={2.5} /> Reclutar héroe
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function RecruitModal({ classes, onRecruit, onClose }) {
  const userId      = useAppStore(s => s.userId)
  const queryClient = useQueryClient()
  const [name, setName]       = useState('')
  const [classId, setClassId] = useState(classes?.[0]?.id ?? '')

  const recruitMutation = useMutation({
    mutationFn: () => apiPost('/api/hero-recruit', { heroName: name, heroClass: classId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
      onRecruit()
      onClose()
    },
    onError: (err) => toast.error(err.message),
  })

  function handleSubmit(e) {
    e.preventDefault()
    recruitMutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-[14px] p-7 w-[min(100%,400px)] shadow-[var(--shadow-lg)] flex flex-col gap-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[1.1rem] font-bold text-text">Reclutar héroe</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.75rem] font-semibold text-text-2">Nombre</label>
            <input
              className="px-3 py-2 border border-border rounded-lg bg-surface-2 text-text text-[0.88rem] font-[inherit] outline-none transition-[border-color] duration-150 focus:border-[var(--blue-500)]"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del héroe"
              maxLength={20}
              autoFocus
              required
            />
          </div>

          {/* Clase */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.75rem] font-semibold text-text-2">Clase</label>
            <div className="flex gap-1.5 flex-wrap">
              {classes?.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`px-3 py-[0.35rem] border rounded-lg text-[0.78rem] font-semibold cursor-pointer transition-all duration-150
                    ${classId === c.id
                      ? 'border-[var(--blue-500)] bg-info-bg text-[var(--blue-600)]'
                      : 'border-border bg-surface-2 text-text-2 hover:border-border-2'
                    }`}
                  onClick={() => setClassId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-2.5 justify-end pt-1">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={recruitMutation.isPending}>
              {recruitMutation.isPending ? 'Reclutando...' : 'Reclutar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
