import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { interpolateHp } from '../lib/hpInterpolation'
import { ChevronRight, Plus, Map, Sword, Moon } from 'lucide-react'
import { motion } from 'framer-motion'

/* ── constants ────────────────────────────────────────────────────────────── */

const SLOT_UNLOCK = { 2: 5, 3: 10 }

const STATUS = {
  ready:     { color: '#16a34a', label: 'Misión lista',   dot: '#16a34a' },
  exploring: { color: '#d97706', label: 'Explorando',     dot: '#d97706' },
  available: { color: '#2563eb', label: 'Disponible',     dot: '#2563eb' },
  recovering:{ color: '#94a3b8', label: 'Recuperando HP', dot: '#94a3b8' },
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function fmtDuration(ms) {
  if (ms <= 0) return 'Listo'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function getDerivedStatus(hero, now) {
  if (hero.status === 'exploring') {
    const active = hero.expeditions?.find(e => e.status === 'traveling')
    if (active && new Date(active.ends_at) <= now) return 'ready'
  }
  return hero.status
}

/* ── HeroCard ─────────────────────────────────────────────────────────────── */

function HeroCard({ hero, now, onClick, index }) {
  const rawStatus = getDerivedStatus(hero, now)
  const hpNow     = interpolateHp(hero, now.getTime())
  const hpPct     = Math.min(100, Math.round((hpNow / hero.max_hp) * 100))
  const hpColor   = hpPct >= 60 ? '#16a34a' : hpPct >= 30 ? '#d97706' : '#dc2626'

  const activeExp = hero.expeditions?.find(e => e.status === 'traveling')
  const msLeft    = activeExp ? Math.max(0, new Date(activeExp.ends_at) - now) : 0

  const isFullHp = hpNow >= hero.max_hp
  const statusKey = rawStatus === 'ready' ? 'ready'
    : rawStatus === 'exploring' ? 'exploring'
    : isFullHp ? 'available'
    : 'recovering'

  const s = STATUS[statusKey]
  const StatusIcon = statusKey === 'ready' || statusKey === 'exploring' ? Map
    : statusKey === 'available' ? Sword : Moon

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      onClick={onClick}
      className="group flex flex-col gap-4 p-4 bg-surface border border-border rounded-[14px] shadow-[var(--shadow-sm)] text-left transition-[border-color,box-shadow] duration-150 hover:border-[var(--blue-200)] hover:shadow-[var(--shadow-md)] w-full font-[inherit] cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
            <span className="font-['Rajdhani',sans-serif] text-[18px] font-bold tracking-[0.02em] text-text truncate">
              {hero.name}
            </span>
          </div>
          <p className="text-[12px] text-text-3 mt-0.5 pl-4">
            {hero.classes?.name ?? 'Héroe'} · Nv.{hero.level}
          </p>
        </div>
        <ChevronRight size={15} strokeWidth={2} className="text-text-3 flex-shrink-0 mt-1 transition-transform duration-150 group-hover:translate-x-0.5" />
      </div>

      {/* HP bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-text-3">HP</span>
          <span style={{ color: hpColor }}>{hpNow} / {hero.max_hp}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--border)_70%,transparent)] overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${hpPct}%`, background: hpColor }} />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: s.color }}>
        <StatusIcon size={13} strokeWidth={2} />
        <span>
          {statusKey === 'ready'      && 'Misión completada — recoge la recompensa'}
          {statusKey === 'exploring'  && `Explorando · ${fmtDuration(msLeft)} restante`}
          {statusKey === 'available'  && 'Disponible — listo para explorar'}
          {statusKey === 'recovering' && `Recuperando HP · ${hpPct}% · ${fmtDuration(Math.ceil((hero.max_hp - hpNow) / (hero.max_hp / 60)) * 60000)}`}
        </span>
      </div>
    </motion.button>
  )
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

export default function Inicio() {
  const userId            = useAppStore(s => s.userId)
  const navigateToHeroTab = useAppStore(s => s.navigateToHeroTab)
  const setSelectedHeroId = useAppStore(s => s.setSelectedHeroId)
  const setRecruitOpen    = useAppStore(s => s.setRecruitOpen)

  const { heroes }    = useHeroes(userId)
  const { buildings } = useBuildings(userId)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const barrackLevel = (buildings ?? []).find(b => b.type === 'barracks')?.level ?? 1
  const usedSlots    = heroes.map(h => h.slot ?? 1)
  const nextSlot     = [1, 2, 3].find(s => !usedSlots.includes(s))
  const canRecruit   = !!(nextSlot && (!SLOT_UNLOCK[nextSlot] || barrackLevel >= SLOT_UNLOCK[nextSlot]))

  function goToHero(heroId) {
    setSelectedHeroId(heroId)
    navigateToHeroTab('ficha')
  }

  return (
    <div className="flex flex-col gap-5 max-w-[700px] mx-auto">

      <div className="flex items-center justify-between">
        <h2 className="section-title">Tus héroes</h2>
        {canRecruit && (
          <button className="btn btn--ghost btn--sm border-dashed" onClick={() => setRecruitOpen(true)}>
            <Plus size={11} strokeWidth={2.5} /> Reclutar
          </button>
        )}
      </div>

      <div className={`grid gap-3 ${heroes.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} grid-cols-1`}>
        {heroes.map((hero, i) => (
          <HeroCard key={hero.id} hero={hero} now={now} index={i} onClick={() => goToHero(hero.id)} />
        ))}
      </div>

    </div>
  )
}
