import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResources } from '../hooks/useResources'
import { useMissions } from '../hooks/useMissions'
import Base from '../sections/Base'
import Hero from '../sections/Hero'
import Dungeons from '../sections/Dungeons'
import Torre from '../sections/Torre'
import Misiones from '../sections/Misiones'
import Ranking from '../sections/Ranking'
import ThemeToggle from '../components/ThemeToggle'
import { RecruitModal } from '../components/HeroPicker'
import { useTheme } from '../hooks/useTheme'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { Castle, Sword, Skull, Trophy, Coins, Axe, Sparkles, FlaskConical, TowerControl, ClipboardList, X, Plus, LogOut } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import './Dashboard.css'

const sectionVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}

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
    <div style={{ padding: '24px', fontFamily: 'monospace', fontSize: 13 }}>
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
    <div style={{ padding: '24px', fontFamily: 'monospace', fontSize: 13 }}>
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

const HERO_STATUS_COLOR = { idle: '#16a34a', exploring: '#d97706', resting: '#0369a1', ready: '#16a34a' }
const HERO_STATUS_LABEL = { idle: 'Reposo', exploring: 'Explorando', resting: 'Recuperando', ready: 'Lista ✓' }

function getHeroDerivedStatus(hero, now) {
  if (hero.status === 'exploring') {
    const activeExp = hero.expeditions?.find(e => e.status === 'traveling')
    if (activeExp && new Date(activeExp.ends_at) <= now) return 'ready'
  }
  return hero.status
}

// Slots desbloqueables según nivel del Cuartel
// Para añadir más héroes en el futuro: ampliar este mapa y los arrays de slots
const SLOT_UNLOCK = { 2: 5, 3: 10 }

const NAV_ITEMS = [
  { id: 'heroe',         label: 'Héroe',         icon: Sword },
  { id: 'base',          label: 'Base',          icon: Castle },
  { id: 'mazmorras',     label: 'Mazmorras',     icon: Skull },
  { id: 'torre',         label: 'Torre',         icon: TowerControl },
  { id: 'clasificacion', label: 'Clasificación', icon: Trophy },
]

function fmt(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString('es-ES')
}

function ResourceChip({ icon: Icon, color, value, rate }) {
  const display = fmt(value)
  return (
    <div className="resource-chip">
      <Icon size={15} color={color} strokeWidth={2} />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={display}
          className="resource-value"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.18 }}
        >
          {display}
        </motion.span>
      </AnimatePresence>
      <span className="resource-rate">+{rate}/min</span>
    </div>
  )
}

function SectionPlaceholder({ title }) {
  return (
    <div className="section-placeholder">
      <p className="section-placeholder-title">{title}</p>
      <p className="section-placeholder-text">Esta sección está en construcción.</p>
    </div>
  )
}

function Dashboard({ session }) {
  const [activeSection, setActiveSection] = useState('heroe')
  const [missionsOpen, setMissionsOpen] = useState(false)
  const { resources, refetch: refetchResources } = useResources(session.user.id)
  const { theme, setTheme } = useTheme()
  const { heroes, refetch: refetchHeroes } = useHeroes(session.user.id)
  const { missions: missionsList, refetch: refetchMissions } = useMissions()
  const [selectedHeroId, setSelectedHeroId] = useState(null)

  const heroId = selectedHeroId ?? heroes?.[0]?.id ?? null
  const selectedHero = heroes.find(h => h.id === heroId) ?? null

  const { buildings, refetch: refetchBuildings } = useBuildings(session.user.id)

  const [recruitClasses, setRecruitClasses] = useState(null)
  const [recruitOpen, setRecruitOpen]       = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  const heroExploring = heroes.some(h => h.status === 'exploring')
  const buildingUpgrading = buildings?.some(b => b.upgrade_ends_at && new Date(b.upgrade_ends_at) > now)
  const workshopLevel = buildings?.find(b => b.type === 'workshop')?.level ?? 1
  const barrackLevel  = buildings?.find(b => b.type === 'barracks')?.level  ?? 1

  // Siguiente slot disponible para reclutar (extensible: añadir más al array)
  const usedSlots = heroes.map(h => h.slot ?? 1)
  const nextRecruitSlot = [1, 2, 3].find(s => !usedSlots.includes(s))
  const canRecruit = !!(nextRecruitSlot && (!SLOT_UNLOCK[nextRecruitSlot] || barrackLevel >= SLOT_UNLOCK[nextRecruitSlot]))

  async function openRecruit() {
    if (!recruitClasses) {
      const { data } = await supabase.from('classes').select('*').order('name')
      setRecruitClasses(data ?? [])
    }
    setRecruitOpen(true)
  }

  const missionsDone  = missionsList?.filter(m => m.claimed).length ?? 0
  const missionsTotal = missionsList?.length ?? 0
  const missionsClaimable = missionsList?.filter(m => m.completed && !m.claimed).length ?? 0
  const allMissionsDone = missionsTotal > 0 && missionsDone === missionsTotal
  const isMobileDrawer = typeof window !== 'undefined' && window.innerWidth <= 600

  function handleMissionsClaim() { refetchMissions(); refetchResources() }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="dash-root">

      {/* Header */}
      <header className="dash-header">
        <span className="dash-logo">RPG Heroes</span>

        <div className="dash-resources">
          <ResourceChip icon={Coins}    color="#d97706" value={resources?.gold} rate={resources?.gold_rate ?? '—'} />
          <ResourceChip icon={Axe}      color="#16a34a" value={resources?.wood} rate={resources?.wood_rate ?? '—'} />
          <ResourceChip icon={Sparkles} color="#7c3aed" value={resources?.mana} rate={resources?.mana_rate ?? '—'} />
        </div>

        <div className="dash-user">
          <button
            className={`missions-chip ${allMissionsDone ? 'missions-chip--done' : missionsClaimable > 0 ? 'missions-chip--claimable' : ''}`}
            onClick={() => setMissionsOpen(true)}
            title="Misiones del día"
          >
            <ClipboardList size={14} strokeWidth={2} />
            <span>{missionsDone}/{missionsTotal}</span>
            {missionsClaimable > 0 && <span className="missions-chip-dot" />}
          </button>
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <div className="dash-avatar" title={session.user.email}>
            {session.user.user_metadata?.avatar_url
              ? <img src={session.user.user_metadata.avatar_url} alt="" className="dash-avatar-img" referrerPolicy="no-referrer" />
              : <span className="dash-avatar-initials">{(session.user.user_metadata?.name ?? session.user.email ?? '?')[0].toUpperCase()}</span>
            }
          </div>
          <button className="dash-logout" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={14} strokeWidth={2} />
            <span className="dash-logout-label">Salir</span>
          </button>
        </div>
      </header>

      {/* Resource bar — solo visible en móvil */}
      <div className="dash-resources-mobile">
        <ResourceChip icon={Coins}    color="#d97706" value={resources?.gold} rate={resources?.gold_rate ?? '—'} />
        <ResourceChip icon={Axe}      color="#16a34a" value={resources?.wood} rate={resources?.wood_rate ?? '—'} />
        <ResourceChip icon={Sparkles} color="#7c3aed" value={resources?.mana} rate={resources?.mana_rate ?? '—'} />
        <button
          className={`missions-chip missions-chip--mobile ${allMissionsDone ? 'missions-chip--done' : missionsClaimable > 0 ? 'missions-chip--claimable' : ''}`}
          onClick={() => setMissionsOpen(true)}
          title="Misiones del día"
        >
          <ClipboardList size={13} strokeWidth={2} />
          <span>{missionsDone}/{missionsTotal}</span>
          {missionsClaimable > 0 && <span className="missions-chip-dot" />}
        </button>
      </div>

      {/* Hero rail — visible cuando hay 2+ héroes o se puede reclutar */}
      {(heroes.length > 1 || canRecruit) && (
        <div className="hero-rail">
          {heroes.map(hero => {
            const derivedStatus = getHeroDerivedStatus(hero, now)
            return (
              <button
                key={hero.id}
                className={`hero-rail-chip ${hero.id === heroId ? 'hero-rail-chip--active' : ''} ${derivedStatus === 'ready' ? 'hero-rail-chip--ready' : ''}`}
                onClick={() => setSelectedHeroId(hero.id)}
              >
                <span className="hero-rail-dot" style={{ background: HERO_STATUS_COLOR[derivedStatus] ?? HERO_STATUS_COLOR.idle }} />
                <span className="hero-rail-name">{hero.name}</span>
                <span className="hero-rail-meta">Nv.{hero.level}</span>
                <span className="hero-rail-status">{HERO_STATUS_LABEL[derivedStatus] ?? 'Reposo'}</span>
              </button>
            )
          })}
          {canRecruit && (
            <button className="hero-rail-recruit" onClick={openRecruit}>
              <Plus size={12} strokeWidth={2.5} />
              Reclutar
            </button>
          )}
        </div>
      )}

      <div className="dash-body">

        {/* Sidebar (desktop) */}
        <aside className="dash-sidebar">
          <nav className="dash-nav">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const badge = (id === 'mazmorras' && heroExploring) || (id === 'base' && buildingUpgrading)
              return (
                <button
                  key={id}
                  className={`dash-nav-item ${activeSection === id ? 'dash-nav-item--active' : ''}`}
                  onClick={() => setActiveSection(id)}
                >
                  {activeSection === id && (
                    <motion.span
                      className="dash-nav-indicator"
                      layoutId="nav-indicator"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="dash-nav-icon">
                    <Icon size={18} strokeWidth={1.8} />
                    {badge && <span className="nav-badge" />}
                  </span>
                  <span className="dash-nav-label">{label}</span>
                </button>
              )
            })}
            {import.meta.env.DEV && (
              <>
                <button
                  className={`dash-nav-item ${activeSection === 'dev-catalogo' ? 'dash-nav-item--active' : ''}`}
                  onClick={() => setActiveSection('dev-catalogo')}
                  style={{ opacity: 0.5, marginTop: 'auto' }}
                >
                  <span className="dash-nav-icon"><FlaskConical size={18} strokeWidth={1.8} /></span>
                  <span className="dash-nav-label">Items</span>
                </button>
                <button
                  className={`dash-nav-item ${activeSection === 'dev-cartas' ? 'dash-nav-item--active' : ''}`}
                  onClick={() => setActiveSection('dev-cartas')}
                  style={{ opacity: 0.5 }}
                >
                  <span className="dash-nav-icon"><FlaskConical size={18} strokeWidth={1.8} /></span>
                  <span className="dash-nav-label">Cartas</span>
                </button>
              </>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="dash-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ flex: 1 }}
            >
              {activeSection === 'heroe'         && <Hero userId={session.user.id} heroId={heroId} />}
              {activeSection === 'base'          && <Base userId={session.user.id} resources={resources} onResourceChange={refetchResources} onBuildingChange={refetchBuildings} />}
              {activeSection === 'mazmorras'     && <Dungeons userId={session.user.id} heroId={heroId} onResourceChange={refetchResources} onHeroChange={refetchHeroes} workshopLevel={workshopLevel} onExpeditionStart={refetchHeroes} />}
              {activeSection === 'torre'         && <Torre userId={session.user.id} heroId={heroId} onResourceChange={refetchResources} />}
              {activeSection === 'clasificacion' && <Ranking userId={session.user.id} />}
              {import.meta.env.DEV && activeSection === 'dev-catalogo' && <CatalogDebug />}
              {import.meta.env.DEV && activeSection === 'dev-cartas'   && <CardCatalogDebug />}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* Bottom bar (mobile) */}
      <nav className="dash-bottombar">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const badge = (id === 'mazmorras' && heroExploring) || (id === 'base' && buildingUpgrading)
          return (
            <button
              key={id}
              className={`dash-bottombar-item ${activeSection === id ? 'dash-bottombar-item--active' : ''}`}
              onClick={() => setActiveSection(id)}
            >
              <span className="dash-bottombar-icon">
                <Icon size={20} strokeWidth={1.8} />
                {badge && <span className="nav-badge" />}
              </span>
              <span className="dash-bottombar-label">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Missions drawer */}
      <AnimatePresence>
        {missionsOpen && (
          <>
            <motion.div
              className="missions-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMissionsOpen(false)}
            />
            <motion.div
              className="missions-drawer"
              initial={isMobileDrawer ? { y: '100%' } : { x: '100%' }}
              animate={isMobileDrawer ? { y: 0 } : { x: 0 }}
              exit={isMobileDrawer ? { y: '100%' } : { x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <button className="missions-drawer-close" onClick={() => setMissionsOpen(false)}>
                <X size={18} strokeWidth={2} />
              </button>
              <div className="missions-drawer-body">
                <Misiones onResourceChange={handleMissionsClaim} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {recruitOpen && recruitClasses && (
        <RecruitModal
          classes={recruitClasses}
          onRecruit={() => { refetchHeroes(); setRecruitOpen(false) }}
          onClose={() => setRecruitOpen(false)}
        />
      )}

    </div>
  )
}

export default Dashboard
