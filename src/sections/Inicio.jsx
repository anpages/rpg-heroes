import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { useMissions } from '../hooks/useMissions'
import { interpolateHp } from '../lib/hpInterpolation'
import { computeBaseLevel } from '../lib/gameConstants'
import { Map, Castle, ClipboardList, ChevronRight, Plus, Moon, Sword, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── constants ────────────────────────────────────────────────────────────── */

const BUILDING_NAMES = {
  energy_nexus: 'Nexo Arcano', gold_mine: 'Mina de Oro', lumber_mill: 'Aserradero',
  mana_well: 'Pozo de Maná', barracks: 'Cuartel', workshop: 'Taller',
  forge: 'Herrería', library: 'Biblioteca',
}

const SLOT_UNLOCK = { 2: 2, 3: 3 } // slot → nivel mínimo de Base

const URGENCY = {
  ready:     { border: '#16a34a', icon: '#16a34a', bg: 'color-mix(in srgb,#16a34a 7%,var(--surface))'  },
  active:    { border: '#d97706', icon: '#d97706', bg: 'color-mix(in srgb,#d97706 5%,var(--surface))'  },
  available: { border: '#2563eb', icon: '#2563eb', bg: 'color-mix(in srgb,#2563eb 5%,var(--surface))'  },
  claimable: { border: '#7c3aed', icon: '#7c3aed', bg: 'color-mix(in srgb,#7c3aed 6%,var(--surface))'  },
  info:      { border: 'var(--border)', icon: 'var(--text-3)', bg: 'var(--surface)' },
}

const STATUS_DOT  = { idle: '#16a34a', exploring: '#d97706', ready: '#16a34a' }

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
  const status  = getDerivedStatus(hero, now)
  const hpNow   = interpolateHp(hero, now.getTime())
  const hpPct   = Math.min(100, Math.round((hpNow / hero.max_hp) * 100))
  const hpColor = hpPct >= 60 ? '#16a34a' : hpPct >= 30 ? '#d97706' : '#dc2626'

  const activeExp = hero.expeditions?.find(e => e.status === 'traveling')
  const msLeft    = activeExp ? Math.max(0, new Date(activeExp.ends_at) - now) : 0
  const isFullHp  = hpNow >= hero.max_hp

  const StatusIcon = status === 'ready' || status === 'exploring' ? Map
    : isFullHp ? Sword : Moon

  const statusColor = status === 'ready' ? '#16a34a'
    : status === 'exploring' ? '#d97706'
    : isFullHp ? '#2563eb' : '#94a3b8'

  const statusText = status === 'ready'     ? 'Misión completada — recoge la recompensa'
    : status === 'exploring' ? `Explorando · ${fmtDuration(msLeft)} restante`
    : isFullHp               ? 'Disponible — listo para explorar'
    : `Recuperando HP · ${hpPct}% · ${fmtDuration(Math.ceil((hero.max_hp - hpNow) / (hero.max_hp / 60)) * 60000)}`

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      onClick={onClick}
      className="group flex flex-col gap-4 p-4 bg-surface border border-border rounded-[14px] shadow-[var(--shadow-sm)] text-left transition-[border-color,box-shadow] duration-150 hover:border-[var(--blue-200)] hover:shadow-[var(--shadow-md)] w-full font-[inherit] cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[status] ?? '#16a34a' }} />
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-text-3">HP</span>
          <span style={{ color: hpColor }}>{hpNow} / {hero.max_hp}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--border)_70%,transparent)] overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${hpPct}%`, background: hpColor }} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: statusColor }}>
        <StatusIcon size={13} strokeWidth={2} />
        <span>{statusText}</span>
      </div>
    </motion.button>
  )
}

/* ── ActivityItem ─────────────────────────────────────────────────────────── */

function ActivityItem({ urgency = 'info', icon: Icon, title, subtitle, extra, timer, badge, onClick, index = 0 }) {
  const u = URGENCY[urgency]
  return (
    <motion.button
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.18 }}
      onClick={onClick}
      className="group flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-[12px] border border-border transition-[box-shadow,border-color] duration-150 hover:shadow-[var(--shadow-md)] font-[inherit] cursor-pointer border-l-[3px]"
      style={{ background: u.bg, borderLeftColor: u.border }}
    >
      <span
        className="w-8 h-8 rounded-[9px] flex items-center justify-center flex-shrink-0"
        style={{
          background: `color-mix(in srgb,${u.icon} 14%,var(--surface-2))`,
          border: `1px solid color-mix(in srgb,${u.icon} 22%,var(--border))`,
          color: u.icon,
        }}
      >
        <Icon size={16} strokeWidth={1.9} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-text leading-tight truncate">{title}</p>
        {subtitle && <p className="text-[12px] text-text-3 mt-0.5 leading-tight truncate">{subtitle}</p>}
        {extra && <p className="text-[11px] mt-0.5 leading-tight truncate font-medium" style={{ color: u.icon }}>{extra}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {timer && <span className="text-[13px] font-bold tabular-nums" style={{ color: u.icon }}>{timer}</span>}
        {badge && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: `color-mix(in srgb,${u.icon} 12%,var(--surface-2))`, color: u.icon }}>
            {badge}
          </span>
        )}
        <ChevronRight size={14} strokeWidth={2} className="text-text-3 transition-transform duration-150 group-hover:translate-x-0.5" />
      </div>
    </motion.button>
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

  const { heroes }    = useHeroes(userId)
  const { buildings } = useBuildings(userId)
  const { missions }  = useMissions()

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const baseLevel    = computeBaseLevel(buildings ?? [])
  const usedSlots    = heroes.map(h => h.slot ?? 1)
  const nextSlot     = [1, 2, 3].find(s => !usedSlots.includes(s))
  const canRecruit   = !!(nextSlot && (!SLOT_UNLOCK[nextSlot] || baseLevel >= SLOT_UNLOCK[nextSlot]))

  // Actividad: solo edificios y misiones (los héroes tienen su propio bloque)
  const activityItems = []
  let idx = 0

  for (const b of buildings ?? []) {
    if (!b.upgrade_ends_at) continue
    const endsAt = new Date(b.upgrade_ends_at)
    const name   = BUILDING_NAMES[b.type] ?? b.type
    if (endsAt <= now) {
      activityItems.push({
        key: `bld-ready-${b.id}`, urgency: 'ready', index: idx++,
        icon: Castle, title: `${name} — mejora completada`,
        subtitle: `Nivel ${b.level} → ${b.level + 1}`, extra: 'Recoge para activar la mejora', badge: '¡Listo!',
        onClick: () => navigateTo('base'),
      })
    } else {
      activityItems.push({
        key: `bld-active-${b.id}`, urgency: 'active', index: idx++,
        icon: Castle, title: `${name} — mejorando`,
        subtitle: `Nivel ${b.level} → ${b.level + 1}`, timer: fmtDuration(endsAt - now),
        onClick: () => navigateTo('base'),
      })
    }
  }

  const claimable = (missions ?? []).filter(m => m.completed && !m.claimed).length
  const done      = (missions ?? []).filter(m => m.claimed).length
  const total     = (missions ?? []).length

  if (claimable > 0) {
    activityItems.push({
      key: 'missions-claimable', urgency: 'claimable', index: idx++,
      icon: ClipboardList,
      title: `${claimable} ${claimable === 1 ? 'misión lista' : 'misiones listas'} para reclamar`,
      subtitle: `${done}/${total} completadas hoy`, extra: 'Recoge tus recompensas', badge: `+${claimable}`,
      onClick: () => setMissionsOpen(true),
    })
  } else if (total > 0) {
    activityItems.push({
      key: 'missions-info', urgency: 'info', index: idx++,
      icon: ClipboardList, title: 'Misiones del día',
      subtitle: `${done}/${total} completadas`,
      extra: done === total ? '✓ Todas completadas' : `${total - done} pendientes`,
      onClick: () => setMissionsOpen(true),
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-[700px] mx-auto">

      {/* Héroes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Héroes</h2>
          {canRecruit && (
            <button className="btn btn--ghost btn--sm border-dashed" onClick={() => setRecruitOpen(true)}>
              <Plus size={11} strokeWidth={2.5} /> Reclutar
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {heroes.map((hero, i) => (
            <HeroCard
              key={hero.id} hero={hero} now={now} index={i}
              onClick={() => { setSelectedHeroId(hero.id); navigateToHeroTab('ficha') }}
            />
          ))}
        </div>
      </section>

      {/* Actividad */}
      {activityItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Zap size={13} strokeWidth={2.5} className="text-text-3" />
            <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-text-3">Actividad</span>
          </div>
          <AnimatePresence mode="popLayout">
            <div className="flex flex-col gap-1.5">
              {activityItems.map(item => <ActivityItem key={item.key} {...item} />)}
            </div>
          </AnimatePresence>
        </section>
      )}

    </div>
  )
}
