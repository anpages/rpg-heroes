import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { Lock, Plus, ChevronDown, Dices } from 'lucide-react'
import { computeBaseLevel, HERO_SLOT_REQUIREMENTS } from '../lib/gameConstants'

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

const HERO_NAMES = [
  'Aldric', 'Seraphina', 'Kael', 'Lyra', 'Theron', 'Elara', 'Darius', 'Freya',
  'Orion', 'Isolde', 'Ragnar', 'Selene', 'Fenris', 'Astrid', 'Cedric', 'Morrigan',
  'Lucian', 'Brynn', 'Zephyr', 'Rowena', 'Draven', 'Nyx', 'Gareth', 'Sylvana',
  'Varen', 'Eira', 'Torin', 'Liora', 'Balthazar', 'Vesper', 'Alaric', 'Ignis',
]

function randomName() {
  return HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)]
}

const SLOT_UNLOCK = HERO_SLOT_REQUIREMENTS
const STATUS_COLOR = {
  idle:        '#16a34a',
  exploring:   '#d97706',
  ready:       '#16a34a',
}
const STATUS_LABEL = {
  idle:        'Reposo',
  exploring:   'Explorando',
  ready:       '¡Recoger!',
}

/**
 * Estado de cabecera del héroe.
 */
function getDerivedStatus(hero) {
  const now = new Date()
  const activeExp = hero.expeditions?.find(e => e.status === 'traveling')
  const expReady  = activeExp && new Date(activeExp.ends_at) <= now

  if (expReady)  return 'ready'
  if (activeExp) return 'exploring'
  return hero.status
}

/**
 * Selector de héroe inline — se monta dentro de secciones que lo necesiten.
 * Se oculta automáticamente si el jugador solo tiene 1 héroe sin slots futuros.
 */
export function HeroSelector() {
  const userId          = useAppStore(s => s.userId)
  const selectedHeroId  = useAppStore(s => s.selectedHeroId)
  const setSelectedHeroId = useAppStore(s => s.setSelectedHeroId)
  const setRecruitOpen  = useAppStore(s => s.setRecruitOpen)
  const activeTab          = useAppStore(s => s.activeTab)
  const navigateToHeroTab  = useAppStore(s => s.navigateToHeroTab)
  const navigateToWorldTab = useAppStore(s => s.navigateToWorldTab)

  function handleSelectHero(id) {
    const isSameHero = id === (selectedHeroId ?? heroes?.[0]?.id)
    setSelectedHeroId(id)
    if (!isSameHero) return
    if (activeTab === 'mundo')       navigateToWorldTab('practica')
    else if (activeTab === 'heroes') navigateToHeroTab('ficha')
  }

  const { heroes }    = useHeroes(userId)
  const { buildings } = useBuildings(userId)

  const baseLevel     = computeBaseLevel(buildings ?? [])
  const usedSlots     = heroes.map(h => h.slot ?? 1)
  const nextSlot      = [1, 2, 3].find(s => !usedSlots.includes(s))
  const canRecruit    = !!(nextSlot && (!SLOT_UNLOCK[nextSlot] || baseLevel >= SLOT_UNLOCK[nextSlot]))
  const lockedSlots   = [2, 3].filter(slot => {
    const filled   = heroes.some(h => h.slot === slot)
    const unlocked = !SLOT_UNLOCK[slot] || baseLevel >= SLOT_UNLOCK[slot]
    return !filled && !unlocked
  })

  // Ocultar si solo hay 1 héroe sin posibilidad de más
  if (heroes.length <= 1 && !canRecruit && lockedSlots.length === 0) return null

  const heroId = selectedHeroId ?? heroes?.[0]?.id ?? null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {heroes.map(hero => {
        const status   = getDerivedStatus(hero)
        const isActive = hero.id === heroId
        const isReady  = status === 'ready'
        return (
          <div key={hero.id} className="relative">
            <button
              className={`flex items-center gap-1.5 px-3 py-[6px] rounded-lg border text-[13px] font-semibold transition-[background,border-color,color] duration-150 whitespace-nowrap font-[inherit] cursor-pointer
                ${isReady
                  ? 'bg-[color-mix(in_srgb,#16a34a_12%,var(--surface-2))] border-[#16a34a] text-[#15803d]'
                  : isActive
                    ? 'bg-info-bg border-[var(--blue-200)] text-[var(--blue-700)]'
                    : 'border-border bg-surface-2 text-text-2 hover:border-border-2 hover:text-text'
                }`}
              onClick={() => handleSelectHero(hero.id)}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${isReady ? 'animate-pulse-dot' : ''}`}
                style={{ background: STATUS_COLOR[status] ?? STATUS_COLOR.idle }}
              />
              {hero.name}
              <span className="text-[11px] font-medium opacity-70">Nv.{hero.level}</span>
              <span className={`hidden sm:inline text-[11px] border-l border-current/20 pl-1.5 ml-0.5 ${isReady ? 'font-bold opacity-90' : 'font-normal opacity-60'}`}>
                {STATUS_LABEL[status] ?? 'Reposo'}
              </span>
              {isActive && (
                <ChevronDown size={12} strokeWidth={2.5} className="flex-shrink-0 opacity-60 ml-0.5" />
              )}
            </button>
            {isActive && (
              <span
                className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-0 h-0 pointer-events-none"
                style={{
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `5px solid ${isReady ? '#16a34a' : 'var(--blue-400)'}`,
                  opacity: 0.7,
                }}
              />
            )}
          </div>
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
          title={`Desbloquea con Base Nv.${SLOT_UNLOCK[slot]}`}
        >
          <Lock size={11} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
          <span className="text-[12px] font-semibold text-text-3">Héroe {slot}</span>
          <span className="hidden sm:inline text-[11px] text-text-3">· Base Nv.{SLOT_UNLOCK[slot]}</span>
        </div>
      ))}
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
    onError: (err) => notify.error(err.message),
  })

  function handleSubmit(e) {
    e.preventDefault()
    recruitMutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-t-[14px] sm:rounded-[14px] w-full sm:w-[min(100%-2rem,400px)] shadow-[var(--shadow-lg)] flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(85dvh, 600px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — fijo, no hace scroll */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-[1.1rem] font-bold text-text">Reclutar héroe</h3>
        </div>

        {/* form ocupa el resto, flex-col para separar body y footer */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          {/* Cuerpo scrollable */}
          <div className="px-5 overflow-y-auto flex flex-col gap-4 flex-1">
            {/* Nombre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.75rem] font-semibold text-text-2">Nombre</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-surface-2 text-text text-[0.88rem] font-[inherit] outline-none transition-[border-color] duration-150 focus:border-[var(--blue-500)]"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nombre del héroe"
                  maxLength={20}
                  required
                />
                <button
                  type="button"
                  className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface-2 text-text-3 hover:text-text hover:border-border-2 transition-colors flex-shrink-0"
                  onClick={() => setName(randomName())}
                  title="Nombre aleatorio"
                >
                  <Dices size={16} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Clase */}
            <div className="flex flex-col gap-1.5 pb-2">
              <label className="text-[0.75rem] font-semibold text-text-2">Clase</label>
              <div className="grid grid-cols-2 gap-2">
                {classes?.map(cls => {
                  const selected = classId === cls.id
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      className={`relative flex flex-col items-start px-3 py-2.5 border-[1.5px] rounded-[10px] text-left cursor-pointer transition-[border-color,background,box-shadow] duration-200
                        ${selected
                          ? 'border-[var(--blue-500)] bg-[var(--blue-50)] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]'
                          : 'bg-surface-2 border-border hover:border-[var(--blue-400)] hover:bg-[var(--blue-50)]'
                        }`}
                      onClick={() => setClassId(cls.id)}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--blue-500)]" />
                      )}
                      <span className={`text-[13px] font-bold mb-1.5 block ${selected ? 'text-[var(--blue-700)]' : 'text-text'}`}>
                        {cls.name}
                      </span>
                      <div className="w-full flex flex-col gap-[4px]">
                        <StatBar label="FUE" value={cls.strength}     selected={selected} />
                        <StatBar label="AGI" value={cls.agility}      selected={selected} />
                        <StatBar label="INT" value={cls.intelligence} selected={selected} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer — shrink-0, SIEMPRE visible */}
          <div className="px-5 py-4 shrink-0 flex gap-2.5 justify-end border-t border-border"
               style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
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
