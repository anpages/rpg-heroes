import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { Lock, Plus, ChevronDown, ChevronRight, Dices } from 'lucide-react'
import { computeBaseLevel, HERO_SLOT_REQUIREMENTS, HERO_SLOT_CLASS, CLASS_LABELS, CLASS_ICONS, CLASS_COLORS } from '../lib/gameConstants'
import { interpolateHp } from '../lib/hpInterpolation'
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

/* ─── Scroll-hint inline (igual que ScrollHint.jsx pero sin dependencia extra) ── */
function HeroScrollRow({ activeId, children }) {
  const ref = useRef(null)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)

  const check = useCallback(() => {
    const el = ref.current
    if (!el) return
    const tol = 2
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - tol)
    setCanScrollLeft(el.scrollLeft > tol)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', check); ro.disconnect() }
  }, [check])

  // Scroll al elemento activo cuando cambia
  useEffect(() => {
    const el = ref.current
    if (!el || activeId == null) return
    const target = el.querySelector(`[data-hero-id="${activeId}"]`)
    if (!target) return
    const elRect     = el.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const offset     = targetRect.left - elRect.left + el.scrollLeft - 8
    el.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' })
  }, [activeId])

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-6"
      >
        {children}
      </div>
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none"
          style={{ background: 'linear-gradient(to right, var(--color-surface), transparent)' }} />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end pointer-events-none pr-0.5"
          style={{ background: 'linear-gradient(to left, var(--color-surface) 30%, transparent)' }}>
          <ChevronRight size={14} strokeWidth={2.5} className="text-text-3 animate-pulse" />
        </div>
      )}
    </div>
  )
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
    <HeroScrollRow activeId={heroId}>
      {heroes.map(hero => {
        const status   = getDerivedStatus(hero)
        const isActive = hero.id === heroId
        const isReady  = status === 'ready'
        return (
          <button
            key={hero.id}
            data-hero-id={hero.id}
            className={`flex items-center gap-1.5 px-3 py-[6px] rounded-lg border text-[13px] font-semibold transition-[background,border-color,color] duration-150 whitespace-nowrap font-[inherit] cursor-pointer flex-shrink-0
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
        )
      })}

      {canRecruit && (
        <button className="btn btn--ghost btn--sm border-dashed flex-shrink-0" onClick={() => setRecruitOpen(true)}>
          <Plus size={12} strokeWidth={2.5} /> Reclutar
        </button>
      )}

      {lockedSlots.map(slot => {
        const cls = HERO_SLOT_CLASS[slot]
        return (
          <div
            key={`locked-${slot}`}
            className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg border border-dashed border-border opacity-45 whitespace-nowrap select-none text-[13px] flex-shrink-0"
          >
            <Lock size={11} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
            <span className="text-[11px] leading-none">{CLASS_ICONS[cls]}</span>
            <span className="text-[12px] font-semibold text-text-3">{CLASS_LABELS[cls]}</span>
            <span className="hidden sm:inline text-[11px] text-text-3">· Nv.{SLOT_UNLOCK[slot]}</span>
          </div>
        )
      })}
    </HeroScrollRow>
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
 * Selector de héroe para secciones de combate — tarjetas grandes con info de combate.
 * locked=true bloquea la selección (p.ej. torneo en curso).
 * activeId + onSelect: modo controlado (QuickCombat). Sin props → usa el store global.
 */
export function HeroCombatPicker({ locked = false, activeId: activeIdProp, onSelect, activeExtras = null }) {
  const userId         = useAppStore(s => s.userId)
  const selectedHeroId = useAppStore(s => s.selectedHeroId)
  const setSelected    = useAppStore(s => s.setSelectedHeroId)
  const { heroes }     = useHeroes(userId)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10_000)
    return () => clearInterval(id)
  }, [])

  if (!heroes?.length) return null

  const isControlled  = activeIdProp !== undefined && onSelect !== undefined
  const activeId      = isControlled ? activeIdProp : selectedHeroId
  const handleSelect  = isControlled ? onSelect : setSelected
  const nowMs = Date.now()

  return (
    <div className="flex flex-col gap-2">
      {heroes.map(hero => {
        const status    = getDerivedStatus(hero)
        const canFight  = !locked && (status === 'idle' || status === 'ready')
        const isActive  = hero.id === activeId
        const cls       = hero.class
        const clsColor  = CLASS_COLORS[cls] ?? 'var(--text-3)'
        const hpNow     = interpolateHp(hero, nowMs)
        const maxHp     = hero.max_hp ?? 100
        const hpPct     = Math.min(100, Math.round((hpNow / maxHp) * 100))
        const hpColor   = hpPct > 60 ? '#16a34a' : hpPct > 30 ? '#d97706' : '#dc2626'
        const statusLabel = status === 'ready'     ? '¡Recoger pendiente!'
                          : status === 'exploring' ? 'En expedición'
                          : hero.status !== 'idle' ? 'Ocupado'
                          : 'Listo'

        const durColor = activeExtras
          ? activeExtras.durPct > 60 ? '#16a34a' : activeExtras.durPct > 30 ? '#d97706' : '#dc2626'
          : null

        return (
          <button
            key={hero.id}
            disabled={!canFight}
            onClick={() => canFight && handleSelect(hero.id)}
            className={`w-full flex flex-col rounded-xl border text-left transition-[border-color,background] duration-150 font-[inherit] overflow-hidden
              ${isActive
                ? 'border-[var(--blue-500)] bg-info-bg'
                : canFight
                  ? 'border-border bg-surface-2 cursor-pointer active:bg-surface'
                  : 'border-border bg-surface-2 opacity-45 cursor-default'
              }`}
          >
            {/* Fila principal */}
            <div className="flex items-center gap-3 px-3 py-3">
              {/* Icono de clase */}
              <div
                className="rounded-xl flex items-center justify-center flex-shrink-0 text-[22px] leading-none"
                style={{
                  width: '44px',
                  height: '44px',
                  background: `color-mix(in srgb, ${clsColor} 14%, var(--surface))`,
                  border: `1.5px solid color-mix(in srgb, ${clsColor} 28%, var(--border))`,
                }}
              >
                {CLASS_ICONS[cls] ?? '⚔'}
              </div>

              {/* Nombre + nivel + estado */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[14px] font-bold text-text truncate leading-tight">{hero.name}</span>
                  <span className="text-[11px] font-semibold text-text-3 flex-shrink-0">Nv.{hero.level}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: canFight ? '#16a34a' : '#d97706' }}
                  />
                  <span className="text-[12px] font-semibold" style={{ color: canFight ? '#16a34a' : 'var(--text-3)' }}>
                    {statusLabel}
                  </span>
                  {/* HP inline — siempre visible */}
                  <span className="ml-auto text-[11px] font-semibold tabular-nums flex-shrink-0" style={{ color: hpColor }}>
                    {hpPct}% HP
                  </span>
                </div>
              </div>

              {/* Check activo */}
              {isActive && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--blue-500)' }}
                >
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>

            {/* Extras — solo card activa con datos */}
            {isActive && activeExtras && (
              <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border/60 pt-2.5">
                {/* Stats en grid 2 columnas */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {/* HP */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-text-3">HP</span>
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: hpColor }}>{hpPct}%</span>
                    </div>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${hpPct}%`, background: hpColor }} />
                    </div>
                  </div>
                  {/* Equipo */}
                  {activeExtras.durPct != null ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-text-3">Equipo</span>
                        <span className="text-[11px] font-semibold" style={{ color: durColor }}>{activeExtras.durPct}%</span>
                      </div>
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${activeExtras.durPct}%`, background: durColor }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="text-[11px] text-text-3">Sin equipo</span>
                    </div>
                  )}
                </div>
                {/* Rating + Tácticas en la misma fila */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color: activeExtras.tier.color,
                      background: `color-mix(in srgb, ${activeExtras.tier.color} 12%, var(--surface))`,
                      border: `1px solid color-mix(in srgb, ${activeExtras.tier.color} 22%, var(--border))`,
                    }}
                  >
                    {activeExtras.tier.label}
                  </span>
                  {activeExtras.equippedTactics.map(t => (
                    <span
                      key={t.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-surface border border-border rounded text-[11px] font-semibold text-text-2"
                    >
                      <span className="text-[10px]">{t.tactic_catalog.icon}</span>
                      <span>{t.tactic_catalog.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </button>
        )
      })}

    </div>
  )
}
