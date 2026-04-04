import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResources } from '../hooks/useResources'
import Base from '../sections/Base'
import Hero from '../sections/Hero'
import Dungeons from '../sections/Dungeons'
import Torre from '../sections/Torre'
import Misiones from '../sections/Misiones'
import Ranking from '../sections/Ranking'
import ThemeToggle from '../components/ThemeToggle'
import HeroPicker from '../components/HeroPicker'
import { useTheme } from '../hooks/useTheme'
import { useHeroes } from '../hooks/useHeroes'
import { Castle, Sword, Skull, Trophy, Coins, Axe, Sparkles, FlaskConical, TowerControl, ClipboardList } from 'lucide-react'
import './Dashboard.css'

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

/* ─────────────────────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { id: 'heroe',         label: 'Héroe',         icon: Sword },
  { id: 'base',          label: 'Base',          icon: Castle },
  { id: 'mazmorras',     label: 'Mazmorras',     icon: Skull },
  { id: 'torre',         label: 'Torre',         icon: TowerControl },
  { id: 'misiones',      label: 'Misiones',      icon: ClipboardList },
  { id: 'clasificacion', label: 'Clasificación', icon: Trophy },
]

function fmt(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toLocaleString('es-ES')
}

function ResourceChip({ icon: Icon, color, value, rate }) {
  return (
    <div className="resource-chip">
      <Icon size={15} color={color} strokeWidth={2} />
      <span className="resource-value">{fmt(value)}</span>
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
  const { resources } = useResources(session.user.id)
  const { theme, setTheme } = useTheme()
  const { heroes, refetch: refetchHeroes } = useHeroes(session.user.id)
  const [selectedHeroId, setSelectedHeroId] = useState(null)

  // Seleccionar el primer héroe disponible cuando carguen
  const heroId = selectedHeroId ?? heroes?.[0]?.id ?? null

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
          <ResourceChip icon={Axe} color="#16a34a" value={resources?.wood} rate={resources?.wood_rate ?? '—'} />
          <ResourceChip icon={Sparkles} color="#7c3aed" value={resources?.mana} rate={resources?.mana_rate ?? '—'} />
        </div>

        <div className="dash-user">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <span className="dash-email">{session.user.email}</span>
          <button className="dash-logout" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      {/* Resource bar — solo visible en móvil */}
      <div className="dash-resources-mobile">
        <ResourceChip icon={Coins}    color="#d97706" value={resources?.gold} rate={resources?.gold_rate ?? '—'} />
        <ResourceChip icon={Axe} color="#16a34a" value={resources?.wood} rate={resources?.wood_rate ?? '—'} />
        <ResourceChip icon={Sparkles} color="#7c3aed" value={resources?.mana} rate={resources?.mana_rate ?? '—'} />
      </div>

      <div className="dash-body">

        {/* Sidebar (desktop) */}
        <aside className="dash-sidebar">
          <nav className="dash-nav">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`dash-nav-item ${activeSection === id ? 'dash-nav-item--active' : ''}`}
                onClick={() => setActiveSection(id)}
              >
                <span className="dash-nav-icon"><Icon size={18} strokeWidth={1.8} /></span>
                <span className="dash-nav-label">{label}</span>
              </button>
            ))}
            {import.meta.env.DEV && (
              <button
                className={`dash-nav-item ${activeSection === 'dev-catalogo' ? 'dash-nav-item--active' : ''}`}
                onClick={() => setActiveSection('dev-catalogo')}
                style={{ opacity: 0.5, marginTop: 'auto' }}
              >
                <span className="dash-nav-icon"><FlaskConical size={18} strokeWidth={1.8} /></span>
                <span className="dash-nav-label">Catálogo</span>
              </button>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="dash-main">
          {heroId && ['heroe','mazmorras','torre'].includes(activeSection) && (
            <HeroPicker
              heroes={heroes}
              selectedHeroId={heroId}
              onSelect={setSelectedHeroId}
              onRefetch={refetchHeroes}
            />
          )}
          {activeSection === 'heroe'         && <Hero userId={session.user.id} heroId={heroId} />}
          {activeSection === 'base'          && <Base userId={session.user.id} resources={resources} />}
          {activeSection === 'mazmorras'     && <Dungeons userId={session.user.id} heroId={heroId} />}
          {activeSection === 'torre'         && <Torre userId={session.user.id} heroId={heroId} />}
          {activeSection === 'misiones'      && <Misiones />}
          {activeSection === 'clasificacion' && <Ranking userId={session.user.id} />}
          {import.meta.env.DEV && activeSection === 'dev-catalogo' && <CatalogDebug />}
        </main>

      </div>

      {/* Bottom bar (mobile) */}
      <nav className="dash-bottombar">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`dash-bottombar-item ${activeSection === id ? 'dash-bottombar-item--active' : ''}`}
            onClick={() => setActiveSection(id)}
          >
            <span className="dash-bottombar-icon"><Icon size={20} strokeWidth={1.8} /></span>
            <span className="dash-bottombar-label">{label}</span>
          </button>
        ))}
      </nav>

    </div>
  )
}

export default Dashboard
