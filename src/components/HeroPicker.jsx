import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { Lock, Plus, ChevronDown, Dices } from 'lucide-react'
import { computeBaseLevel, HERO_SLOT_REQUIREMENTS, HERO_SLOT_CLASS, CLASS_LABELS, CLASS_ICONS, CLASS_COLORS } from '../lib/gameConstants'
import { motion } from 'framer-motion'

const EASE_OUT = [0.22, 1, 0.36, 1]
const EASE_IN  = [0.55, 0, 0.75, 0.06]

const sheetVariants = {
  initial: { y: '100%' },
  animate: { y: 0,      transition: { type: 'tween', ease: EASE_OUT, duration: 0.26 } },
  exit:    { y: '100%', transition: { type: 'tween', ease: EASE_IN,  duration: 0.18 } },
}

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
}

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
  // Fantásticos originales
  'Aldric', 'Seraphina', 'Kael', 'Lyra', 'Theron', 'Elara', 'Darius', 'Freya',
  'Orion', 'Isolde', 'Ragnar', 'Selene', 'Fenris', 'Astrid', 'Cedric', 'Morrigan',
  'Lucian', 'Brynn', 'Zephyr', 'Rowena', 'Draven', 'Nyx', 'Gareth', 'Sylvana',
  'Varen', 'Eira', 'Torin', 'Liora', 'Balthazar', 'Vesper', 'Alaric', 'Ignis',
  // Mitología griega
  'Aquiles', 'Héctor', 'Odiseo', 'Perseo', 'Teseo', 'Heracles', 'Jasón', 'Leónidas',
  'Ariadna', 'Calíope', 'Medea', 'Andrómeda', 'Atalanta', 'Penélope', 'Circe', 'Electra',
  'Patroclo', 'Diomedes', 'Áyax', 'Neoptólemo', 'Menelao', 'Agamenón', 'Belerofontes',
  // Mitología nórdica
  'Sigurd', 'Brynhildr', 'Gunnar', 'Völsung', 'Njord', 'Vidar', 'Tyr', 'Baldur',
  'Skadi', 'Hlin', 'Gudrun', 'Sigrid', 'Ulfberht', 'Ivar', 'Bjorn', 'Halfdan',
  'Rollo', 'Leif', 'Gunhild', 'Ragnhild', 'Torbjörn', 'Solveig',
  // Mitología romana
  'Romulus', 'Remus', 'Brutus', 'Cassius', 'Maximus', 'Corvus', 'Galba', 'Scipio',
  'Camilla', 'Lavinia', 'Volumnia', 'Aemilia', 'Cornelia', 'Claudia', 'Valeria',
  'Quintus', 'Lucius', 'Marcus', 'Titus', 'Caius', 'Flavius', 'Gaius', 'Severus',
  // Guerreros históricos y leyendas
  'Attila', 'Genghis', 'Khalid', 'Saladin', 'Hannibal', 'Spartacus', 'Vercingetorix',
  'Boudicca', 'Zenobia', 'Tomyris', 'Artemisia', 'Khutulun', 'Lagertha',
  'Rodrigo', 'Pelayo', 'Almanzor', 'Bernardo', 'Ximena', 'Ermengarda',
  // Mitología celta y artúrica
  'Arturus', 'Lancelot', 'Gawain', 'Percival', 'Tristan', 'Galahad', 'Geraint',
  'Guinevere', 'Morgause', 'Nimueh', 'Lunette', 'Elaine', 'Isolde',
  'Cú Chulainn', 'Fionn', 'Diarmuid', 'Grainne', 'Scathach', 'Medb',
  // Mitología oriental y árabe
  'Rustam', 'Sohrab', 'Gilgamesh', 'Enkidu', 'Sinuhé', 'Ramesses', 'Imhotep',
  'Aladin', 'Scheherazade', 'Badr', 'Antarah', 'Qays', 'Layla', 'Shahryar',
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
  const nextSlot      = [1, 2, 3, 4, 5].find(s => !usedSlots.includes(s))
  const canRecruit    = !!(nextSlot && (!SLOT_UNLOCK[nextSlot] || baseLevel >= SLOT_UNLOCK[nextSlot]))
  const lockedSlots   = [2, 3, 4, 5].filter(slot => {
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

      {lockedSlots.map(slot => {
        const cls = HERO_SLOT_CLASS[slot]
        return (
          <div
            key={`locked-${slot}`}
            className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg border border-dashed border-border opacity-45 whitespace-nowrap select-none text-[13px]"
            title={`Desbloquea con Base Nv.${SLOT_UNLOCK[slot]}`}
          >
            <Lock size={11} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
            <span className="text-[11px] leading-none">{CLASS_ICONS[cls]}</span>
            <span className="text-[12px] font-semibold text-text-3">{CLASS_LABELS[cls]}</span>
            <span className="hidden sm:inline text-[11px] text-text-3">· Nv.{SLOT_UNLOCK[slot]}</span>
          </div>
        )
      })}
    </div>
  )
}

export function RecruitModal({ nextSlot, onRecruit, onClose }) {
  const userId      = useAppStore(s => s.userId)
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const cls      = HERO_SLOT_CLASS[nextSlot]
  const clsLabel = CLASS_LABELS[cls]
  const clsIcon  = CLASS_ICONS[cls]

  const recruitMutation = useMutation({
    mutationFn: () => apiPost('/api/hero-recruit', { heroName: name }),
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
    <motion.div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[1000] sm:p-5"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 'min(420px, 100vw)' }}
        variants={sheetVariants} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-[1.1rem] font-bold text-text">Nuevo héroe desbloqueado</h3>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="px-5 pb-2 flex flex-col gap-4">
            {/* Clase fija — informativa */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border">
              <span className="text-[22px] leading-none">{clsIcon}</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-bold text-text">{clsLabel}</span>
                <span className="text-[12px] text-text-3">Clase asignada al slot {nextSlot}</span>
              </div>
            </div>

            {/* Nombre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.75rem] font-semibold text-text-2">Ponle nombre</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-surface-2 text-text text-[0.88rem] font-[inherit] outline-none transition-[border-color] duration-150 focus:border-[var(--blue-500)]"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nombre del héroe"
                  maxLength={20}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-surface-2 text-text-3 hover:text-text hover:border-border-2 transition-colors flex-shrink-0"
                  onClick={() => setName(randomName())}
                >
                  <Dices size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 shrink-0 flex gap-2.5 justify-end border-t border-border mt-2"
               style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={recruitMutation.isPending || !name.trim()}>
              {recruitMutation.isPending ? 'Desbloqueando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

/**
 * Selector de héroe para secciones de combate (inline, compacto).
 * Se oculta si el jugador solo tiene 1 héroe.
 * locked=true bloquea la selección (p.ej. torneo en curso).
 * activeId + onSelect: modo controlado (QuickCombat). Sin props → usa el store global.
 */
export function HeroCombatPicker({ locked = false, activeId: activeIdProp, onSelect }) {
  const userId         = useAppStore(s => s.userId)
  const selectedHeroId = useAppStore(s => s.selectedHeroId)
  const setSelected    = useAppStore(s => s.setSelectedHeroId)
  const { heroes }     = useHeroes(userId)

  if (!heroes?.length) return null

  const isControlled = activeIdProp !== undefined && onSelect !== undefined
  const activeId     = isControlled ? activeIdProp : selectedHeroId
  const handleSelect = isControlled ? onSelect : setSelected
  const unlockedSlots = new Set(heroes.map(h => h.slot_index ?? 1))

  return (
    <div className="flex gap-2 flex-wrap">
      {heroes.map(hero => {
        const status   = getDerivedStatus(hero)
        const canFight = !locked && (status === 'idle' || status === 'ready')
        const isActive = hero.id === activeId

        return (
          <button
            key={hero.id}
            disabled={!canFight}
            onClick={() => canFight && handleSelect(hero.id)}
            className={`flex items-center gap-2 px-3 py-[7px] rounded-lg border text-[13px] font-semibold transition-[border-color,color] duration-150 whitespace-nowrap font-[inherit] bg-surface-2
              ${isActive && canFight
                ? 'border-border text-text'
                : !canFight
                  ? 'border-border text-text-3 opacity-50 cursor-default'
                  : 'border-border text-text-2 hover:text-text cursor-pointer'
              }`}
            style={{}}
          >
            <span className="text-[15px] leading-none">{CLASS_ICONS[hero.class] ?? '⚔'}</span>
            <span>{hero.name}</span>
            <span className="text-[11px] opacity-70">Nv.{hero.level}</span>
            {!canFight && (
              <span className="text-[11px] opacity-70">
                {status === 'exploring' ? '· Explorando' : status === 'ready' ? '· ¡Recoger!' : '· Ocupado'}
              </span>
            )}
          </button>
        )
      })}

      {/* Slots bloqueados — orientación al jugador */}
      {[2, 3, 4, 5].filter(slot => !unlockedSlots.has(slot)).map(slot => (
        <div
          key={`locked-${slot}`}
          className="flex items-center gap-2 px-3 py-[7px] rounded-lg border border-dashed border-border text-[13px] font-semibold text-text-3 opacity-40 cursor-default whitespace-nowrap"
        >
          <span className="text-[15px] leading-none">{CLASS_ICONS[HERO_SLOT_CLASS[slot]] ?? '⚔'}</span>
          <span>{CLASS_LABELS[HERO_SLOT_CLASS[slot]]}</span>
          <Lock size={11} strokeWidth={2.5} />
        </div>
      ))}
    </div>
  )
}
