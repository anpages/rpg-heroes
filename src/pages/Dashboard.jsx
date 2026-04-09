import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { useTraining, hasReadyPoint } from '../hooks/useTraining'
import { useTrainingRooms } from '../hooks/useTrainingRooms'
import { useResearch } from '../hooks/useResearch'
import { useHeroId } from '../hooks/useHeroId'
import { useClasses } from '../hooks/useClasses'
import { useMissions } from '../hooks/useMissions'
import { useAppStore } from '../store/appStore'
import Base from '../sections/Base'
import Hero from '../sections/Hero'
import Dungeons from '../sections/Dungeons'
import Equipo from '../sections/Equipo'
import Cartas from '../sections/Cartas'
import Combates from '../sections/Combates'
import Shop from '../sections/Shop'
import Misiones from '../sections/Misiones'
import ErrorBoundary from '../components/ErrorBoundary'
import ThemeToggle from '../components/ThemeToggle'
import { RecruitModal, HeroSelector } from '../components/HeroPicker'
import { useTheme } from '../hooks/useTheme'
import { Castle, Sword, Globe, Map, FlaskConical, X, LogOut, ShoppingBag, ClipboardList, Shield, Layers, Swords } from 'lucide-react'

function DiscordIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}
import { AnimatePresence, motion } from 'framer-motion'


/* ─── DEV ONLY: Catálogo de items ───────────────────────────────────────────── */

const RARITY_COLORS = {
  common: '#6b7280', uncommon: '#16a34a', rare: '#2563eb', epic: '#7c3aed', legendary: '#d97706',
}
const SLOT_ORDER = ['helmet', 'chest', 'arms', 'legs', 'main_hand', 'off_hand', 'accessory']

function CatalogDebug() {
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.from('item_catalog').select('*').order('slot').order('tier').order('rarity')
      .then(({ data }) => setItems(data ?? []))
  }, [])

  if (!items) return <p style={{ padding: 40, color: '#94a3b8' }}>Cargando catálogo...</p>

  const slots = filter === 'all' ? SLOT_ORDER : [filter]
  const grouped = slots.reduce((acc, slot) => {
    acc[slot] = items.filter(i => i.slot === slot)
    return acc
  }, {})

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Catálogo de items</h2>
        <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>DEV ONLY</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{items.length} items</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', ...SLOT_ORDER].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid',
            borderColor: filter === s ? '#2563eb' : '#e2e8f0',
            background: filter === s ? '#eff6ff' : 'white',
            color: filter === s ? '#2563eb' : '#475569',
            fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>{s}</button>
        ))}
      </div>

      {slots.map(slot => grouped[slot].length > 0 && (
        <div key={slot} style={{ marginBottom: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 8 }}>{slot}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#f8fafc', fontSize: 11 }}>
                {['Nombre','Tier','Rareza','2H','Atq','Def','HP','Fue','Agi','Int','Dur'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped[slot].map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 600, color: RARITY_COLORS[item.rarity] }}>{item.name}</td>
                  <td style={{ padding: '6px 10px', color: '#475569' }}>T{item.tier}</td>
                  <td style={{ padding: '6px 10px', color: RARITY_COLORS[item.rarity] }}>{item.rarity}</td>
                  <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{item.is_two_handed ? '✓' : '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{item.attack_bonus || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{item.defense_bonus || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{item.hp_bonus || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{item.strength_bonus || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{item.agility_bonus || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>{item.intelligence_bonus || '—'}</td>
                  <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{item.max_durability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/* ─── DEV ONLY: Catálogo de cartas ─────────────────────────────────────────── */

const CATEGORY_COLORS = { offense: '#f97316', defense: '#94a3b8', mobility: '#60a5fa', equipment: '#fbbf24', hybrid: '#c084fc' }
const CATEGORY_LABELS = { offense: 'Ofensa', defense: 'Resistencia', mobility: 'Movilidad', equipment: 'Equipo', hybrid: 'Híbrida' }
const CATEGORIES = ['offense', 'defense', 'mobility', 'equipment', 'hybrid']

function CardCatalogDebug() {
  const [cards, setCards] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.from('skill_cards').select('*').order('category').order('rarity')
      .then(({ data }) => setCards(data ?? []))
  }, [])

  if (!cards) return <p style={{ padding: 40, color: '#94a3b8' }}>Cargando cartas...</p>

  const cats = filter === 'all' ? CATEGORIES : [filter]
  const grouped = cats.reduce((acc, cat) => {
    acc[cat] = cards.filter(c => c.card_category === cat)
    return acc
  }, {})

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Catálogo de Cartas</h2>
        <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>DEV ONLY</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{cards.length} cartas</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid',
            borderColor: filter === cat ? (CATEGORY_COLORS[cat] ?? '#2563eb') : '#e2e8f0',
            background: filter === cat ? 'white' : 'white',
            color: filter === cat ? (CATEGORY_COLORS[cat] ?? '#2563eb') : '#475569',
            fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>{cat === 'all' ? 'Todas' : CATEGORY_LABELS[cat]}</button>
        ))}
      </div>

      {cats.map(cat => grouped[cat].length > 0 && (
        <div key={cat} style={{ marginBottom: 28 }}>
          <p style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: CATEGORY_COLORS[cat], marginBottom: 8 }}>
            {CATEGORY_LABELS[cat]}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#f8fafc', fontSize: 11 }}>
                {['Nombre', 'Descripción', 'Bonus (R1)', 'Penalización (R1)'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped[cat].map(card => (
                <tr key={card.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: CATEGORY_COLORS[card.card_category] ?? '#475569' }}>{card.name}</td>
                  <td style={{ padding: '6px 10px', color: '#64748b', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.description}</td>
                  <td style={{ padding: '6px 10px', color: '#16a34a', fontWeight: 600 }}>
                    {(card.bonuses ?? []).map(b => `+${b.value} ${b.stat}`).join(', ') || '—'}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#dc2626', fontWeight: 600 }}>
                    {(card.penalties ?? []).map(p => `−${p.value} ${p.stat}`).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function getHeroDerivedStatus(hero, now) {
  if (hero.status === 'exploring') {
    const activeExp = hero.expeditions?.find(e => e.status === 'traveling')
    if (activeExp && new Date(activeExp.ends_at) <= now) return 'ready'
  }
  return hero.status
}

const NAV_ITEMS = [
  { id: 'base',   label: 'Base',   icon: Castle },
  { id: 'heroes', label: 'Héroes', icon: Sword  },
  { id: 'mundo',  label: 'Combate', icon: Globe  },
  { id: 'arena',  label: 'Arena',  icon: Swords },
]

const HERO_SUB_TABS = [
  { id: 'ficha',        label: 'Ficha',        icon: Sword       },
  { id: 'equipo',       label: 'Equipo',       icon: Shield      },
  { id: 'cartas',       label: 'Cartas',       icon: Layers      },
  { id: 'expediciones', label: 'Expediciones', icon: Map         },
  { id: 'tienda',       label: 'Tienda',       icon: ShoppingBag },
]




function Dashboard({ session }) {
  const activeTab         = useAppStore(s => s.activeTab)
  const activeHeroTab     = useAppStore(s => s.activeHeroTab)
  const mountedTabs       = useAppStore(s => s.mountedTabs)
  const navigateTo        = useAppStore(s => s.navigateTo)
  const navigateToHeroTab = useAppStore(s => s.navigateToHeroTab)
  const missionsOpen      = useAppStore(s => s.missionsOpen)
  const setMissionsOpen   = useAppStore(s => s.setMissionsOpen)
  const recruitOpen       = useAppStore(s => s.recruitOpen)
  const setRecruitOpen    = useAppStore(s => s.setRecruitOpen)
  const { heroes }                   = useHeroes(session.user.id)
  const { buildings }                = useBuildings(session.user.id)
  const heroId                       = useHeroId()
  const { rooms: trainingRooms }     = useTrainingRooms(session.user.id)
  const { rows: trainingProgress }   = useTraining(heroId)
  const { research }                 = useResearch(session.user.id)
  const { classes: recruitClasses } = useClasses()
  const { missions }                = useMissions()
  const { theme, setTheme }        = useTheme()

  const mainRef = useRef(null)
  const [now, setNow] = useState(() => new Date())
  const mundoKey = useRef(0)
  const prevTab  = useRef(activeTab)
  if (prevTab.current !== activeTab) {
    if (activeTab === 'mundo') mundoKey.current++
    prevTab.current = activeTab
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(interval)
  }, [])

  // Scroll to top al cambiar de tab
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [activeTab])

  const anyHeroReady     = heroes.some(h => getHeroDerivedStatus(h, now) === 'ready')
  const anyHeroExploring = !anyHeroReady && heroes.some(h => h.status === 'exploring')

  const buildingUpgradingReady      = buildings?.some(b => b.upgrade_ends_at && new Date(b.upgrade_ends_at) <= now) ?? false
  const buildingUpgradingInProgress = !buildingUpgradingReady && (buildings?.some(b => b.upgrade_ends_at && new Date(b.upgrade_ends_at) > now) ?? false)

  const progressByStat = Object.fromEntries((trainingProgress ?? []).map(r => [r.stat, r]))
  const trainingReady  = (trainingRooms ?? []).some(r => hasReadyPoint(progressByStat[r.stat], r.level))

  const researchActive = research?.active
  const researchReady  = researchActive && new Date(researchActive.ends_at) <= now
  const researchInProgress = researchActive && !researchReady

  const trainingRoomsInProgress = (trainingRooms ?? []).some(r => r.building_ends_at && new Date(r.building_ends_at) > now)
  const trainingRoomsDone       = (trainingRooms ?? []).some(r => r.built_at === null && r.building_ends_at && new Date(r.building_ends_at) <= now)

  const missionsClaimable = (missions ?? []).filter(m => m.completed && !m.claimed).length

  const isMobileDrawer = typeof window !== 'undefined' && window.innerWidth <= 600

  async function handleLogout() { await supabase.auth.signOut() }

  function badgeState(id) {
    if (id === 'heroes') return anyHeroReady ? 'ready' : anyHeroExploring ? 'active' : null
    if (id === 'base') {
      const isReady  = buildingUpgradingReady || trainingReady || trainingRoomsDone || researchReady
      const isActive = !isReady && (buildingUpgradingInProgress || researchInProgress || trainingRoomsInProgress)
      return isReady ? 'ready' : isActive ? 'active' : null
    }
    return null
  }

  return (
    <div className="h-dvh flex flex-col bg-bg overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 bg-surface border-b border-border shadow-[var(--shadow-sm)] sticky top-0 z-[100] flex-shrink-0">
        <span
          className="font-hero font-bold text-[26px] tracking-[0.08em] flex-shrink-0"
          style={{
            background: 'linear-gradient(120deg, #93c5fd 0%, #60a5fa 40%, #3b82f6 70%, #1d4ed8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          RPG Legends
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-2.5">
          <button
            className="btn btn--ghost btn--icon relative"
            onClick={() => setMissionsOpen(true)}
            title="Misiones"
          >
            <ClipboardList size={17} strokeWidth={1.8} />
            {missionsClaimable > 0 && (
              <span className="absolute -top-[3px] -right-[3px] min-w-[16px] h-4 px-[3px] rounded-full bg-[#7c3aed] border-2 border-surface text-[10px] font-bold text-white flex items-center justify-center leading-none">
                {missionsClaimable}
              </span>
            )}
          </button>
          <ThemeToggle theme={theme} setTheme={setTheme} />

          <button
            className="btn btn--ghost btn--sm hover:text-error-text hover:border-[color-mix(in_srgb,var(--error-text)_40%,var(--border))] hover:bg-[color-mix(in_srgb,var(--error-text)_6%,transparent)]"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <LogOut size={14} strokeWidth={2} />
            <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex w-[220px] flex-shrink-0 bg-surface border-r border-border flex-col p-4 pt-4 px-3 overflow-y-auto self-stretch">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon, accent }) => {
              const badge    = badgeState(id)
              const isActive = activeTab === id
              const iconColor = isActive ? 'var(--blue-700)' : (accent ?? undefined)
              return (
                <button
                  key={id}
                  className={`flex items-center gap-3 px-3 py-[10px] rounded-lg border-0 bg-transparent text-[14px] font-medium text-left transition-[background,color] duration-150 w-full relative
                    ${isActive
                      ? 'text-[var(--blue-700)] font-semibold hover:bg-transparent'
                      : 'text-text-2 hover:bg-bg hover:text-text'
                    }`}
                  onClick={() => navigateTo(id)}
                >
                  {isActive && (
                    <motion.span
                      className="absolute inset-0 rounded-lg bg-[var(--blue-50)] z-0"
                      layoutId="nav-indicator"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-[1] w-5 h-5 flex items-center justify-center flex-shrink-0" style={iconColor ? { color: iconColor } : undefined}>
                    <Icon size={18} strokeWidth={1.8} />
                    {badge && (
                      <span className={`absolute -top-[3px] -right-[3px] w-2 h-2 rounded-full border-2 border-surface ${badge === 'active' ? 'bg-[#d97706] animate-nav-badge-pulse' : 'bg-[#16a34a]'}`} />
                    )}
                  </span>
                  <span className="relative z-[1] leading-none">{label}</span>
                </button>
              )
            })}
            <a
              href="https://discord.gg/WKeRr7m5"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-[10px] rounded-lg text-[14px] font-medium text-text-2 hover:bg-bg hover:text-text transition-[background,color] duration-150 mt-auto"
            >
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <DiscordIcon size={18} />
              </span>
              <span className="leading-none">Discord</span>
            </a>

            {import.meta.env.DEV && (
              <>
                <button
                  className={`flex items-center gap-3 px-3 py-[10px] rounded-lg border-0 bg-transparent text-[14px] font-medium text-left transition-[background,color] duration-150 w-full relative opacity-50 mt-auto ${activeTab === 'dev-catalogo' ? 'text-[var(--blue-700)] font-semibold' : 'text-text-2 hover:bg-bg hover:text-text'}`}
                  onClick={() => navigateTo('dev-catalogo')}
                >
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0"><FlaskConical size={18} strokeWidth={1.8} /></span>
                  <span className="leading-none">Items</span>
                </button>
                <button
                  className={`flex items-center gap-3 px-3 py-[10px] rounded-lg border-0 bg-transparent text-[14px] font-medium text-left transition-[background,color] duration-150 w-full relative opacity-50 ${activeTab === 'dev-cartas' ? 'text-[var(--blue-700)] font-semibold' : 'text-text-2 hover:bg-bg hover:text-text'}`}
                  onClick={() => navigateTo('dev-cartas')}
                >
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0"><FlaskConical size={18} strokeWidth={1.8} /></span>
                  <span className="leading-none">Cartas</span>
                </button>
              </>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-2 pt-3 pb-0 md:p-8 md:pb-8 min-h-0 relative overflow-x-hidden [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:auto">

          {/* Héroes — con sub-nav */}
          <div className={activeTab === 'heroes' ? 'block animate-section-in' : 'hidden'}>
            {mountedTabs.has('heroes') && (
              <div className="flex flex-col gap-6">
                {/* Selector de héroe */}
                <HeroSelector />
                {/* Sub-nav */}
                <div className="border-b border-border">
                <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mb-px">
                  {HERO_SUB_TABS.map(({ id, label, icon: Icon }) => {
                    const isActive = activeHeroTab === id
                    const hasAlert    = id === 'expediciones' && anyHeroReady
                    const hasExploring = id === 'expediciones' && !anyHeroReady && anyHeroExploring
                    return (
                      <button
                        key={id}
                        className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 border-x-0 border-t-0 transition-[color,border-color] duration-150 bg-transparent font-[inherit]"
                        style={{
                          borderBottomColor: isActive ? '#2563eb' : 'transparent',
                          color: isActive ? '#2563eb' : 'var(--text-3)',
                        }}
                        onClick={() => navigateToHeroTab(id)}
                      >
                        <Icon size={14} strokeWidth={2} />
                        {label}
                        {hasAlert && (
                          <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-nav-badge-pulse flex-shrink-0" />
                        )}
                        {hasExploring && (
                          <span className="w-2 h-2 rounded-full bg-[#d97706] animate-nav-badge-pulse flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
                </div>
                {/* Sub-content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeHeroTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {activeHeroTab === 'ficha'        && <ErrorBoundary><Hero /></ErrorBoundary>}
                    {activeHeroTab === 'equipo'       && <ErrorBoundary><Equipo /></ErrorBoundary>}
                    {activeHeroTab === 'cartas'       && <ErrorBoundary><Cartas /></ErrorBoundary>}
                    {activeHeroTab === 'expediciones' && <ErrorBoundary><Dungeons /></ErrorBoundary>}
                    {activeHeroTab === 'tienda'       && <ErrorBoundary><Shop /></ErrorBoundary>}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Base */}
          <div className={activeTab === 'base' ? 'block animate-section-in' : 'hidden'}>
            {mountedTabs.has('base') && <ErrorBoundary><Base mainRef={mainRef} /></ErrorBoundary>}
          </div>

          {/* Mundo */}
          <div className={activeTab === 'mundo' ? 'block animate-section-in' : 'hidden'}>
            {mountedTabs.has('mundo') && <ErrorBoundary><Combates key={mundoKey.current} /></ErrorBoundary>}
          </div>

          {/* Arena */}
          <div className={activeTab === 'arena' ? 'block animate-section-in' : 'hidden'}>
            <div className="flex flex-col items-center gap-4 py-20 px-6 text-center">
              <Swords size={48} strokeWidth={1.2} className="text-text-3 opacity-60" />
              <h2 className="section-title">Arena PvP</h2>
              <p className="text-text-2 text-[14px] max-w-xs">Los combates entre jugadores llegarán próximamente. Entrena a tu héroe y prepárate para el desafío.</p>
            </div>
          </div>


          {/* DEV only */}
          {import.meta.env.DEV && (
            <>
              <div className={activeTab === 'dev-catalogo' ? 'block animate-section-in' : 'hidden'}>
                {mountedTabs.has('dev-catalogo') && <CatalogDebug />}
              </div>
              <div className={activeTab === 'dev-cartas' ? 'block animate-section-in' : 'hidden'}>
                {mountedTabs.has('dev-cartas') && <CardCatalogDebug />}
              </div>
            </>
          )}

          {/* Spacer: compensates for fixed bottom nav on mobile (including iPhone safe area) */}
          <div className="md:hidden flex-shrink-0" style={{ height: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }} aria-hidden="true" />

        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.06)] z-[100]" style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '4rem' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon, accent }) => {
          const badge = badgeState(id)
          const isActive = activeTab === id
          const iconColor = isActive ? 'var(--blue-600)' : (accent ?? undefined)
          return (
            <button
              key={id}
              className={`flex-1 flex flex-col items-center justify-center gap-1 border-0 bg-transparent text-[11px] font-medium transition-[color,background] duration-150 py-2 px-1 hover:bg-bg
                ${isActive ? 'text-[var(--blue-600)] font-semibold' : 'text-text-3'}`}
              onClick={() => navigateTo(id)}
            >
              <span className="relative w-[22px] h-[22px] flex items-center justify-center" style={iconColor ? { color: iconColor } : undefined}>
                <Icon size={20} strokeWidth={1.8} />
                {badge && (
                  <span className={`absolute -top-[3px] -right-[3px] w-2 h-2 rounded-full border-2 border-surface ${badge === 'active' ? 'bg-[#d97706] animate-nav-badge-pulse' : 'bg-[#16a34a]'}`} />
                )}
              </span>
              <span className="leading-none">{label}</span>
            </button>
          )
        })}
        <a
          href="https://discord.gg/WKeRr7m5"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex flex-col items-center justify-center gap-1 border-0 bg-transparent text-[11px] font-medium text-text-3 hover:bg-bg transition-[color,background] duration-150 py-2 px-1"
        >
          <span className="w-[22px] h-[22px] flex items-center justify-center">
            <DiscordIcon size={20} />
          </span>
          <span className="leading-none">Discord</span>
        </a>
      </nav>

      {/* Missions drawer */}
      <AnimatePresence>
        {missionsOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/35 z-[200] backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={() => setMissionsOpen(false)}
            />
            <motion.div
              className={`fixed bg-bg border-border z-[201] flex flex-col overflow-hidden
                ${isMobileDrawer
                  ? 'bottom-0 left-0 right-0 w-full max-h-[88vh] border-t rounded-t-[20px] shadow-[0_-4px_32px_rgba(0,0,0,0.15)]'
                  : 'top-0 right-0 bottom-0 w-[420px] max-w-[100vw] border-l shadow-[-4px_0_24px_rgba(0,0,0,0.12)]'
                }`}
              initial={isMobileDrawer ? { y: '100%' } : { x: '100%' }}
              animate={isMobileDrawer
                ? { y: 0,      transition: { type: 'tween', ease: [0.25, 0.46, 0.45, 0.94], duration: 0.38 } }
                : { x: 0,      transition: { type: 'tween', ease: [0.25, 0.46, 0.45, 0.94], duration: 0.32 } }
              }
              exit={isMobileDrawer
                ? { y: '100%', transition: { type: 'tween', ease: [0.55, 0, 0.75, 0.06], duration: 0.26 } }
                : { x: '100%', transition: { type: 'tween', ease: [0.55, 0, 0.75, 0.06], duration: 0.24 } }
              }
            >
              <button className="btn btn--ghost btn--icon absolute top-4 right-4 z-[1]" onClick={() => setMissionsOpen(false)}>
                <X size={18} strokeWidth={2} />
              </button>
              <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8 sm:pb-12">
                <Misiones />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {recruitOpen && recruitClasses && (
        <RecruitModal
          classes={recruitClasses}
          onRecruit={() => setRecruitOpen(false)}
          onClose={() => setRecruitOpen(false)}
        />
      )}

    </div>
  )
}

export default Dashboard
