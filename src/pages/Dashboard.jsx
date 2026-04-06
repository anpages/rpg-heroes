import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useResources } from '../hooks/useResources'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { useClasses } from '../hooks/useClasses'
import { useMissions } from '../hooks/useMissions'
import { useAppStore } from '../store/appStore'
import Base from '../sections/Base'
import Hero from '../sections/Hero'
import Dungeons from '../sections/Dungeons'
import Combates from '../sections/Combates'
import Shop from '../sections/Shop'
import Misiones from '../sections/Misiones'
import ErrorBoundary from '../components/ErrorBoundary'
import ThemeToggle from '../components/ThemeToggle'
import { RecruitModal, HeroSelector } from '../components/HeroPicker'
import { useTheme } from '../hooks/useTheme'
import { Castle, Sword, Globe, Map, Coins, Axe, Sparkles, FlaskConical, X, LogOut, ShoppingBag, ClipboardList } from 'lucide-react'
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

const CATEGORY_COLORS = { attack: '#d97706', defense: '#475569', strength: '#dc2626', agility: '#0369a1', intelligence: '#7c3aed' }
const CATEGORY_LABELS = { attack: 'Ataque', defense: 'Defensa', strength: 'Fuerza', agility: 'Agilidad', intelligence: 'Inteligencia' }
const CATEGORIES = ['attack', 'defense', 'strength', 'agility', 'intelligence']

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
    acc[cat] = cards.filter(c => c.category === cat)
    return acc
  }, {})

  const statCols = [
    { key: 'attack_bonus', label: 'Atq' },
    { key: 'defense_bonus', label: 'Def' },
    { key: 'hp_bonus', label: 'HP' },
    { key: 'strength_bonus', label: 'Fue' },
    { key: 'agility_bonus', label: 'Agi' },
    { key: 'intelligence_bonus', label: 'Int' },
  ]

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
                {['Nombre', 'Rareza', 'Coste', 'Maná fusión', 'Descripción', ...statCols.map(s => s.label)].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped[cat].map(card => (
                <tr key={card.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: RARITY_COLORS[card.rarity] }}>{card.name}</td>
                  <td style={{ padding: '6px 10px', color: RARITY_COLORS[card.rarity] }}>{card.rarity}</td>
                  <td style={{ padding: '6px 10px', color: '#475569' }}>{card.base_cost}</td>
                  <td style={{ padding: '6px 10px', color: '#7c3aed' }}>{card.base_mana_fuse}</td>
                  <td style={{ padding: '6px 10px', color: '#64748b', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.description}</td>
                  {statCols.map(s => (
                    <td key={s.key} style={{ padding: '6px 10px', color: card[s.key] > 0 ? '#16a34a' : '#94a3b8' }}>
                      {card[s.key] > 0 ? `+${card[s.key]}` : '—'}
                    </td>
                  ))}
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
  { id: 'base',    label: 'Base',    icon: Castle      },
  { id: 'heroes',  label: 'Héroes',  icon: Sword       },
  { id: 'mundo',   label: 'Mundo',   icon: Globe       },
  { id: 'tienda',  label: 'Tienda',  icon: ShoppingBag },
]

const HERO_SUB_TABS = [
  { id: 'ficha',        label: 'Ficha',        icon: Sword },
  { id: 'expediciones', label: 'Expediciones', icon: Map   },
]

function fmt(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString('es-ES')
}

function ResourceChip({ icon: Icon, color, value, rate, className }) {
  const display = fmt(value)
  return (
    <div className={`flex items-center gap-[5px] bg-surface-2 border border-border rounded-lg py-[5px] px-[10px] text-[13px] font-semibold text-text whitespace-nowrap${className ? ' ' + className : ''}`}>
      <Icon size={15} color={color} strokeWidth={2} />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={display}
          className="min-w-[36px] text-right"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.18 }}
        >
          {display}
        </motion.span>
      </AnimatePresence>
      <span className="text-[11px] font-medium text-text-3 border-l border-border pl-1.5 ml-0.5">+{rate}/min</span>
    </div>
  )
}

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
  const { resources }               = useResources(session.user.id)
  const { heroes }                  = useHeroes(session.user.id)
  const { buildings }               = useBuildings(session.user.id)
  const { classes: recruitClasses } = useClasses()
  const { missions }                = useMissions()
  const { theme, setTheme }        = useTheme()

  const mainRef = useRef(null)
  const [now, setNow] = useState(() => new Date())

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

  const missionsClaimable = (missions ?? []).filter(m => m.completed && !m.claimed).length

  const isMobileDrawer = typeof window !== 'undefined' && window.innerWidth <= 600

  async function handleLogout() { await supabase.auth.signOut() }

  function badgeState(id) {
    if (id === 'heroes') return anyHeroReady ? 'ready' : anyHeroExploring ? 'active' : null
    if (id === 'base')   return buildingUpgradingReady ? 'ready' : buildingUpgradingInProgress ? 'active' : null
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 bg-surface border-b border-border shadow-[var(--shadow-sm)] sticky top-0 z-[100] flex-shrink-0">
        <span className="font-display text-[22px] tracking-[0.08em] text-[var(--blue-700)] flex-shrink-0">RPG Heroes</span>

        {/* Resources — desktop only */}
        <div className="hidden md:flex items-center gap-1.5 flex-1 justify-center">
          <ResourceChip icon={Coins}    color="#d97706" value={resources?.gold} rate={resources?.gold_rate ?? '—'} />
          <ResourceChip icon={Axe}      color="#16a34a" value={resources?.wood} rate={resources?.wood_rate ?? '—'} />
          <ResourceChip icon={Sparkles} color="#7c3aed" value={resources?.mana} rate={resources?.mana_rate ?? '—'} />
        </div>

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
          <div className="w-8 h-8 rounded-full border-2 border-border bg-surface-2 overflow-hidden flex-shrink-0 flex items-center justify-center" title={session.user.email}>
            {session.user.user_metadata?.avatar_url
              ? <img src={session.user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover block" referrerPolicy="no-referrer" />
              : <span className="text-[13px] font-bold text-text-2 leading-none">{(session.user.user_metadata?.name ?? session.user.email ?? '?')[0].toUpperCase()}</span>
            }
          </div>
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

      {/* Resource bar — mobile only */}
      <div className="flex md:hidden items-center justify-around gap-2 px-3 py-2 bg-surface border-b border-border overflow-x-auto flex-shrink-0">
        <ResourceChip icon={Coins}    color="#d97706" value={resources?.gold} rate={resources?.gold_rate ?? '—'} className="flex-1 justify-center min-w-0" />
        <ResourceChip icon={Axe}      color="#16a34a" value={resources?.wood} rate={resources?.wood_rate ?? '—'} className="flex-1 justify-center min-w-0" />
        <ResourceChip icon={Sparkles} color="#7c3aed" value={resources?.mana} rate={resources?.mana_rate ?? '—'} className="flex-1 justify-center min-w-0" />
      </div>

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
        <main ref={mainRef} className="flex-1 overflow-y-auto p-5 pb-20 md:p-8 md:pb-8 min-h-0 relative overflow-x-hidden [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:auto">

          {/* Héroes — con sub-nav */}
          <div className={activeTab === 'heroes' ? 'block animate-section-in' : 'hidden'}>
            {mountedTabs.has('heroes') && (
              <div className="flex flex-col gap-6">
                {/* Selector de héroe */}
                <HeroSelector />
                {/* Sub-nav */}
                <div className="flex items-center gap-1 border-b border-border pb-0 -mt-1">
                  {HERO_SUB_TABS.map(({ id, label, icon: Icon }) => {
                    const isActive = activeHeroTab === id
                    return (
                      <button
                        key={id}
                        className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-[color,border-color] duration-150 bg-transparent border-x-0 border-t-0 font-[inherit]
                          ${isActive
                            ? 'border-b-[var(--blue-600)] text-[var(--blue-700)]'
                            : 'border-b-transparent text-text-3 hover:text-text'
                          }`}
                        onClick={() => navigateToHeroTab(id)}
                      >
                        <Icon size={14} strokeWidth={2} />
                        {label}
                      </button>
                    )
                  })}
                </div>
                {/* Sub-content */}
                <div className={activeHeroTab === 'ficha' ? 'block' : 'hidden'}>
                  {mountedTabs.has('heroes:ficha') && <ErrorBoundary><Hero /></ErrorBoundary>}
                </div>
                <div className={activeHeroTab === 'expediciones' ? 'block' : 'hidden'}>
                  {mountedTabs.has('heroes:expediciones') && <ErrorBoundary><Dungeons /></ErrorBoundary>}
                </div>
              </div>
            )}
          </div>

          {/* Base */}
          <div className={activeTab === 'base' ? 'block animate-section-in' : 'hidden'}>
            {mountedTabs.has('base') && <ErrorBoundary><Base /></ErrorBoundary>}
          </div>

          {/* Mundo */}
          <div className={activeTab === 'mundo' ? 'block animate-section-in' : 'hidden'}>
            {mountedTabs.has('mundo') && <ErrorBoundary><Combates /></ErrorBoundary>}
          </div>

          {/* Tienda */}
          <div className={activeTab === 'tienda' ? 'block animate-section-in' : 'hidden'}>
            {mountedTabs.has('tienda') && <ErrorBoundary><Shop /></ErrorBoundary>}
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

        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.06)] z-[100]">
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
