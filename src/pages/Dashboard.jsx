import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useResources } from '../hooks/useResources'
import Base from '../sections/Base'
import Hero from '../sections/Hero'
import Dungeons from '../sections/Dungeons'
import Ranking from '../sections/Ranking'
import { Home, Sword, Skull, Trophy, Coins, Axe, Sparkles } from 'lucide-react'
import './Dashboard.css'

const NAV_ITEMS = [
  { id: 'base',          label: 'Base',          icon: Home },
  { id: 'heroe',         label: 'Héroe',         icon: Sword },
  { id: 'mazmorras',     label: 'Mazmorras',     icon: Skull },
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
  const [activeSection, setActiveSection] = useState('base')
  const { resources } = useResources(session.user.id)

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
          </nav>
        </aside>

        {/* Main content */}
        <main className="dash-main">
          {activeSection === 'base'          && <Base userId={session.user.id} resources={resources} />}
          {activeSection === 'heroe'         && <Hero userId={session.user.id} />}
          {activeSection === 'mazmorras'     && <Dungeons userId={session.user.id} />}
          {activeSection === 'clasificacion' && <Ranking userId={session.user.id} />}
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
