import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { useMissions } from '../hooks/useMissions'
import { interpolateHp } from '../lib/hpInterpolation'
import { Sword, Castle, ClipboardList, ChevronRight, Swords, Lock, Plus } from 'lucide-react'
import { motion } from 'framer-motion'

/* ── helpers ──────────────────────────────────────────────────────────────── */

const BUILDING_NAMES = {
  energy_nexus: 'Nexo Arcano',
  gold_mine:    'Mina de Oro',
  lumber_mill:  'Aserradero',
  mana_well:    'Pozo de Maná',
  barracks:     'Cuartel',
  workshop:     'Taller',
  forge:        'Herrería',
  library:      'Biblioteca',
}

const STATUS_COLOR = { idle: '#16a34a', exploring: '#d97706', ready: '#16a34a' }
const STATUS_LABEL = { idle: 'En reposo', exploring: 'Explorando', ready: 'Misión lista' }

const SLOT_UNLOCK = { 2: 5, 3: 10 }

function fmtDuration(ms) {
  if (ms <= 0) return 'Listo'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function getHeroDerivedStatus(hero, now) {
  if (hero.status === 'exploring') {
    const active = hero.expeditions?.find(e => e.status === 'traveling')
    if (active && new Date(active.ends_at) <= now) return 'ready'
  }
  return hero.status
}

/* ── HeroCard ─────────────────────────────────────────────────────────────── */

function HeroCard({ hero, now, onClick }) {
  const derivedStatus = getHeroDerivedStatus(hero, now)
  const hpNow         = interpolateHp(hero, now.getTime())
  const hpPct         = Math.min(100, Math.round((hpNow / hero.max_hp) * 100))
  const isReady       = derivedStatus === 'ready'
  const isExploring   = derivedStatus === 'exploring'
  const isFullHp      = hpNow >= hero.max_hp
  const isRecovering  = derivedStatus === 'idle' && !isFullHp

  const activeExp = hero.expeditions?.find(e => e.status === 'traveling')
  const expMsLeft = activeExp ? Math.max(0, new Date(activeExp.ends_at) - now) : 0

  const hpColor = hpPct >= 60 ? '#16a34a' : hpPct >= 30 ? '#d97706' : '#dc2626'

  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 p-4 bg-surface border border-border rounded-[14px] shadow-[var(--shadow-sm)] text-left transition-[border-color,box-shadow] duration-150 hover:border-[var(--blue-200)] hover:shadow-[var(--shadow-md)] w-full font-[inherit]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: STATUS_COLOR[derivedStatus] ?? STATUS_COLOR.idle }}
          />
          <span className="font-['Rajdhani',sans-serif] text-[17px] font-bold tracking-[0.02em] text-text truncate">
            {hero.name}
          </span>
          <span className="text-[12px] font-semibold text-text-3 flex-shrink-0">Nv.{hero.level}</span>
        </div>
        <ChevronRight size={15} strokeWidth={2} className="text-text-3 flex-shrink-0 mt-0.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--blue-500)]" />
      </div>

      {/* Class */}
      {hero.classes?.name && (
        <span className="text-[12px] font-medium text-text-3 -mt-1">{hero.classes.name}</span>
      )}

      {/* HP bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-text-3">HP</span>
          <span style={{ color: hpColor }}>{hpNow} / {hero.max_hp}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--border)_60%,transparent)] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${hpPct}%`, background: hpColor }}
          />
        </div>
      </div>

      {/* Status line */}
      <div className="text-[12px] font-medium" style={{ color: STATUS_COLOR[derivedStatus] ?? STATUS_COLOR.idle }}>
        {isReady     && '⚡ Misión completada — recoge la recompensa'}
        {isExploring && `🗺 Explorando · ${fmtDuration(expMsLeft)} restante`}
        {isRecovering && `💤 Recuperando HP · ${hpPct}%`}
        {derivedStatus === 'idle' && isFullHp && '✓ Disponible'}
      </div>
    </button>
  )
}

/* ── WidgetCard ───────────────────────────────────────────────────────────── */

function WidgetCard({ icon: Icon, iconColor, title, children, onClick, actionLabel }) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-surface border border-border rounded-[14px] shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb,${iconColor} 12%,var(--surface-2))`, border: `1px solid color-mix(in srgb,${iconColor} 25%,var(--border))` }}>
          <Icon size={15} strokeWidth={2} style={{ color: iconColor }} />
        </span>
        <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-text-3">{title}</span>
      </div>
      <div className="flex-1">{children}</div>
      {onClick && (
        <button
          onClick={onClick}
          className="btn btn--ghost btn--sm self-start text-[12px]"
        >
          {actionLabel ?? 'Ver'} <ChevronRight size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

export default function Inicio() {
  const userId            = useAppStore(s => s.userId)
  const navigateTo        = useAppStore(s => s.navigateTo)
  const navigateToHeroTab = useAppStore(s => s.navigateToHeroTab)
  const setSelectedHeroId = useAppStore(s => s.setSelectedHeroId)
  const setMissionsOpen   = useAppStore(s => s.setMissionsOpen)
  const setRecruitOpen    = useAppStore(s => s.setRecruitOpen)

  const { heroes }       = useHeroes(userId)
  const { buildings }    = useBuildings(userId)
  const { missions }     = useMissions()

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  /* derived */
  const activeUpgrade = (buildings ?? []).find(
    b => b.upgrade_ends_at && new Date(b.upgrade_ends_at) > now
  )
  const upgradeReady = !activeUpgrade && (buildings ?? []).find(
    b => b.upgrade_ends_at && new Date(b.upgrade_ends_at) <= now
  )

  const missionsDone      = (missions ?? []).filter(m => m.claimed).length
  const missionsTotal     = (missions ?? []).length
  const missionsClaimable = (missions ?? []).filter(m => m.completed && !m.claimed).length

  const barrackLevel  = (buildings ?? []).find(b => b.type === 'barracks')?.level ?? 1
  const usedSlots     = heroes.map(h => h.slot ?? 1)
  const nextSlot      = [1, 2, 3].find(s => !usedSlots.includes(s))
  const canRecruit    = !!(nextSlot && (!SLOT_UNLOCK[nextSlot] || barrackLevel >= SLOT_UNLOCK[nextSlot]))
  const lockedSlots   = [2, 3].filter(slot => {
    const filled   = heroes.some(h => h.slot === slot)
    const unlocked = !SLOT_UNLOCK[slot] || barrackLevel >= SLOT_UNLOCK[slot]
    return !filled && !unlocked
  })

  function goToHero(heroId) {
    setSelectedHeroId(heroId)
    navigateToHeroTab('ficha')
  }

  return (
    <div className="flex flex-col gap-6 max-w-[860px] mx-auto">

      {/* Héroes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Héroes</h2>
          {canRecruit && (
            <button className="btn btn--ghost btn--sm border-dashed" onClick={() => setRecruitOpen(true)}>
              <Plus size={12} strokeWidth={2.5} /> Reclutar
            </button>
          )}
        </div>

        <div className={`grid gap-3 ${heroes.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : heroes.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
          {heroes.map((hero, i) => (
            <motion.div
              key={hero.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
            >
              <HeroCard hero={hero} now={now} onClick={() => goToHero(hero.id)} />
            </motion.div>
          ))}

          {/* Slots bloqueados */}
          {lockedSlots.map(slot => (
            <div
              key={`locked-${slot}`}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-surface border border-dashed border-border rounded-[14px] opacity-50 select-none min-h-[120px]"
            >
              <Lock size={18} strokeWidth={1.8} className="text-text-3" />
              <div className="text-center">
                <p className="text-[13px] font-semibold text-text-3">Slot {slot} bloqueado</p>
                <p className="text-[11px] text-text-3">Cuartel Nv.{SLOT_UNLOCK[slot]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Widgets */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Base widget */}
        <WidgetCard
          icon={Castle}
          iconColor="#0369a1"
          title="Base"
          onClick={() => navigateTo('base')}
          actionLabel="Ver Base"
        >
          {activeUpgrade ? (
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-semibold text-text">
                {BUILDING_NAMES[activeUpgrade.type] ?? activeUpgrade.type}
                <span className="text-text-3 font-medium"> · Nv.{activeUpgrade.level} → {activeUpgrade.level + 1}</span>
              </p>
              <p className="text-[13px] font-medium" style={{ color: '#d97706' }}>
                Listo en {fmtDuration(new Date(activeUpgrade.upgrade_ends_at) - now)}
              </p>
            </div>
          ) : upgradeReady ? (
            <p className="text-[14px] font-semibold text-[#16a34a]">⚡ Mejora lista para recoger</p>
          ) : (
            <p className="text-[13px] text-text-3">Sin mejoras activas</p>
          )}
        </WidgetCard>

        {/* Misiones widget */}
        {missionsTotal > 0 && (
          <WidgetCard
            icon={ClipboardList}
            iconColor="#7c3aed"
            title="Misiones del día"
            onClick={() => setMissionsOpen(true)}
            actionLabel="Ver misiones"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-[color-mix(in_srgb,var(--border)_60%,transparent)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#7c3aed] transition-[width] duration-500"
                    style={{ width: `${Math.round((missionsDone / missionsTotal) * 100)}%` }}
                  />
                </div>
                <span className="text-[12px] font-semibold text-text-3 flex-shrink-0">{missionsDone}/{missionsTotal}</span>
              </div>
              {missionsClaimable > 0 && (
                <p className="text-[13px] font-semibold text-[var(--blue-700)]">
                  {missionsClaimable} {missionsClaimable === 1 ? 'recompensa lista' : 'recompensas listas'}
                </p>
              )}
              {missionsDone === missionsTotal && (
                <p className="text-[13px] font-semibold text-[#16a34a]">✓ Todas completadas</p>
              )}
            </div>
          </WidgetCard>
        )}

        {/* Combates widget */}
        <WidgetCard
          icon={Swords}
          iconColor="#dc2626"
          title="Mundo"
          onClick={() => navigateTo('mundo')}
          actionLabel="Ver Mundo"
        >
          <p className="text-[13px] text-text-3">Torre de Desafíos · Torneos · Clasificación</p>
        </WidgetCard>

      </section>
    </div>
  )
}
