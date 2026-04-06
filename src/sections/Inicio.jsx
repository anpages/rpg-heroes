import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { useMissions } from '../hooks/useMissions'
import { interpolateHp } from '../lib/hpInterpolation'
import { Map, Castle, ClipboardList, ChevronRight, Plus, Sword, Moon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── constants ────────────────────────────────────────────────────────────── */

const BUILDING_NAMES = {
  energy_nexus: 'Nexo Arcano', gold_mine: 'Mina de Oro', lumber_mill: 'Aserradero',
  mana_well: 'Pozo de Maná', barracks: 'Cuartel', workshop: 'Taller',
  forge: 'Herrería', library: 'Biblioteca',
}

const SLOT_UNLOCK = { 2: 5, 3: 10 }

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

/* ── ActivityItem ─────────────────────────────────────────────────────────── */

const URGENCY = {
  ready:     { border: '#16a34a', icon: '#16a34a', bg: 'color-mix(in srgb,#16a34a 8%,var(--surface))'  },
  active:    { border: '#d97706', icon: '#d97706', bg: 'color-mix(in srgb,#d97706 6%,var(--surface))'  },
  claimable: { border: '#7c3aed', icon: '#7c3aed', bg: 'color-mix(in srgb,#7c3aed 7%,var(--surface))'  },
  info:      { border: 'var(--border)', icon: 'var(--text-3)', bg: 'var(--surface)' },
}

function ActivityItem({ urgency = 'info', icon: Icon, title, subtitle, timer, badge, onClick, index = 0 }) {
  const u = URGENCY[urgency]
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      onClick={onClick}
      className="group flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-[12px] border border-border transition-[box-shadow,border-color] duration-150 hover:shadow-[var(--shadow-md)] hover:border-[color-mix(in_srgb,var(--border)_60%,var(--blue-200))] font-[inherit] cursor-pointer border-l-[3px]"
      style={{ background: u.bg, borderLeftColor: u.border }}
    >
      {/* Icon */}
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

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-text leading-tight truncate">{title}</p>
        {subtitle && <p className="text-[12px] text-text-3 mt-0.5 leading-tight truncate">{subtitle}</p>}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {timer && (
          <span className="text-[12px] font-semibold tabular-nums" style={{ color: u.icon }}>
            {timer}
          </span>
        )}
        {badge && (
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: `color-mix(in srgb,${u.icon} 12%,var(--surface-2))`,
              color: u.icon,
            }}
          >
            {badge}
          </span>
        )}
        <ChevronRight
          size={14}
          strokeWidth={2}
          className="text-text-3 transition-transform duration-150 group-hover:translate-x-0.5"
          style={{ color: `color-mix(in srgb,${u.icon} 60%,var(--text-3))` }}
        />
      </div>
    </motion.button>
  )
}

/* ── HeroStrip ────────────────────────────────────────────────────────────── */

function HeroStrip({ hero, now, onClick }) {
  const status  = getDerivedStatus(hero, now)
  const hpNow   = interpolateHp(hero, now.getTime())
  const hpPct   = Math.min(100, Math.round((hpNow / hero.max_hp) * 100))
  const hpColor = hpPct >= 60 ? '#16a34a' : hpPct >= 30 ? '#d97706' : '#dc2626'
  const STATUS_DOT = { idle: '#16a34a', exploring: '#d97706', ready: '#16a34a' }

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 w-full text-left px-4 py-3 bg-surface border border-border rounded-[12px] transition-[border-color,box-shadow] duration-150 hover:border-[var(--blue-200)] hover:shadow-[var(--shadow-sm)] font-[inherit] cursor-pointer"
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[status] ?? '#16a34a' }} />
      <span className="font-['Rajdhani',sans-serif] text-[15px] font-bold tracking-[0.02em] text-text flex-shrink-0">{hero.name}</span>
      <span className="text-[12px] font-medium text-text-3 flex-shrink-0">Nv.{hero.level}</span>
      {hero.classes?.name && (
        <span className="text-[11px] text-text-3 hidden sm:inline flex-shrink-0">· {hero.classes.name}</span>
      )}
      {/* HP bar */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <div className="flex-1 h-1 rounded-full bg-[color-mix(in_srgb,var(--border)_70%,transparent)] overflow-hidden min-w-[40px]">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${hpPct}%`, background: hpColor }} />
        </div>
        <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: hpColor }}>{hpPct}%</span>
      </div>
      <ChevronRight size={13} strokeWidth={2} className="text-text-3 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  )
}

/* ── buildActivities ──────────────────────────────────────────────────────── */

function buildActivities({ heroes, buildings, missions, now, actions }) {
  const items = []
  let idx = 0

  // ── Héroes ────────────────────────────────────────────────────────────────
  for (const hero of heroes) {
    const status = getDerivedStatus(hero, now)
    const activeExp = hero.expeditions?.find(e => e.status === 'traveling')

    if (status === 'ready') {
      items.push({
        key: `exp-ready-${hero.id}`, urgency: 'ready', index: idx++,
        icon: Map, title: `${hero.name} — misión completada`,
        subtitle: 'Recoger recompensa de expedición',
        badge: '¡Listo!',
        onClick: () => { actions.goToExpediciones(hero.id) },
      })
    } else if (status === 'exploring' && activeExp) {
      const msLeft = Math.max(0, new Date(activeExp.ends_at) - now)
      items.push({
        key: `exp-active-${hero.id}`, urgency: 'active', index: idx++,
        icon: Map, title: `${hero.name} — explorando`,
        subtitle: hero.classes?.name ?? null,
        timer: fmtDuration(msLeft),
        onClick: () => { actions.goToExpediciones(hero.id) },
      })
    } else if (status === 'idle') {
      const hpNow = interpolateHp(hero, now.getTime())
      if (hpNow < hero.max_hp) {
        const missingHp = hero.max_hp - hpNow
        const minsToFull = Math.ceil(missingHp / (hero.max_hp / 60))
        items.push({
          key: `hp-${hero.id}`, urgency: 'info', index: idx++,
          icon: Moon, title: `${hero.name} — recuperando HP`,
          subtitle: `${hpNow}/${hero.max_hp} · listo en ${fmtDuration(minsToFull * 60000)}`,
          onClick: () => { actions.goToFicha(hero.id) },
        })
      }
    }
  }

  // ── Edificios ─────────────────────────────────────────────────────────────
  for (const b of buildings ?? []) {
    if (!b.upgrade_ends_at) continue
    const endsAt = new Date(b.upgrade_ends_at)
    const name   = BUILDING_NAMES[b.type] ?? b.type
    if (endsAt <= now) {
      items.push({
        key: `bld-ready-${b.id}`, urgency: 'ready', index: idx++,
        icon: Castle, title: `${name} — mejora completada`,
        subtitle: `Nivel ${b.level} → ${b.level + 1}`,
        badge: '¡Listo!',
        onClick: actions.goToBase,
      })
    } else {
      items.push({
        key: `bld-active-${b.id}`, urgency: 'active', index: idx++,
        icon: Castle, title: `${name} — mejorando`,
        subtitle: `Nivel ${b.level} → ${b.level + 1}`,
        timer: fmtDuration(endsAt - now),
        onClick: actions.goToBase,
      })
    }
  }

  // ── Misiones ──────────────────────────────────────────────────────────────
  const claimable = (missions ?? []).filter(m => m.completed && !m.claimed).length
  const done      = (missions ?? []).filter(m => m.claimed).length
  const total     = (missions ?? []).length

  if (claimable > 0) {
    items.push({
      key: 'missions-claimable', urgency: 'claimable', index: idx++,
      icon: ClipboardList,
      title: `${claimable} ${claimable === 1 ? 'misión lista' : 'misiones listas'} para reclamar`,
      subtitle: `${done}/${total} completadas hoy`,
      onClick: actions.openMissions,
    })
  } else if (total > 0 && done < total) {
    items.push({
      key: 'missions-progress', urgency: 'info', index: idx++,
      icon: ClipboardList, title: 'Misiones del día',
      subtitle: `${done}/${total} completadas`,
      badge: `${done}/${total}`,
      onClick: actions.openMissions,
    })
  }

  // Ordenar: ready primero, luego active, luego claimable, luego info
  const ORDER = { ready: 0, active: 1, claimable: 2, info: 3 }
  items.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency])

  return items
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

  const barrackLevel = (buildings ?? []).find(b => b.type === 'barracks')?.level ?? 1
  const usedSlots    = heroes.map(h => h.slot ?? 1)
  const nextSlot     = [1, 2, 3].find(s => !usedSlots.includes(s))
  const canRecruit   = !!(nextSlot && (!SLOT_UNLOCK[nextSlot] || barrackLevel >= SLOT_UNLOCK[nextSlot]))

  const actions = {
    goToFicha:         (heroId) => { setSelectedHeroId(heroId); navigateToHeroTab('ficha') },
    goToExpediciones:  (heroId) => { setSelectedHeroId(heroId); navigateToHeroTab('expediciones') },
    goToBase:          () => navigateTo('base'),
    openMissions:      () => setMissionsOpen(true),
  }

  const activities = buildActivities({ heroes, buildings, missions, now, actions })

  return (
    <div className="flex flex-col gap-5 max-w-[700px] mx-auto">

      {/* Héroes — overview strip */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sword size={15} strokeWidth={2} className="text-text-3" />
            <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-text-3">Héroes</span>
          </div>
          {canRecruit && (
            <button className="btn btn--ghost btn--sm border-dashed" onClick={() => setRecruitOpen(true)}>
              <Plus size={11} strokeWidth={2.5} /> Reclutar
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {heroes.map(hero => (
            <HeroStrip
              key={hero.id}
              hero={hero}
              now={now}
              onClick={() => actions.goToFicha(hero.id)}
            />
          ))}
        </div>
      </section>

      {/* Actividad */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue-600)] animate-pulse" />
          <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-text-3">Ahora mismo</span>
        </div>

        <AnimatePresence mode="popLayout">
          {activities.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {activities.map(item => (
                <ActivityItem key={item.key} {...item} />
              ))}
            </div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-2 py-10 text-center"
            >
              <span className="text-[28px]">⚔️</span>
              <p className="text-[14px] font-semibold text-text-2">Todo en calma</p>
              <p className="text-[13px] text-text-3">Envía a tus héroes a explorar o mejora tu base.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

    </div>
  )
}
