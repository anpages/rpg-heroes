import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useHeroes } from '../hooks/useHeroes'
import { useBuildings } from '../hooks/useBuildings'
import { useResearch } from '../hooks/useResearch'
import { useHeroId } from '../hooks/useHeroId'
import { useMissions } from '../hooks/useMissions'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { useComebackBonus } from '../hooks/useComebackBonus'
import { useAppStore } from '../store/appStore'
import Base from '../sections/Base'
import Hero from '../sections/Hero'
import Dungeons from '../sections/Dungeons'
import Equipo from '../sections/Equipo'
import Combates from '../sections/Combates'
import Misiones from '../sections/Misiones'
import Tacticas from '../sections/Tacticas'
import Entrenamiento from '../sections/Entrenamiento'
import Logros from '../sections/Logros'
import ErrorBoundary from '../components/ErrorBoundary'
import ThemeToggle from '../components/ThemeToggle'
import { RecruitModal, HeroSelector } from '../components/HeroPicker'
import ScrollHint from '../components/ScrollHint'
import { useTheme } from '../hooks/useTheme'
import { Castle, Sword, Globe, Map, FlaskConical, X, LogOut, ClipboardList, Shield, Layers, Swords, Dumbbell, Trophy } from 'lucide-react'
import { PRODUCTION_BUILDING_TYPES, buildingRate } from '../lib/gameConstants'

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
const SLOT_LABELS = { all: 'Todos', helmet: 'Casco', chest: 'Pecho', arms: 'Brazos', legs: 'Piernas', main_hand: 'Mano ppal.', off_hand: 'Mano sec.', accessory: 'Accesorio' }

const CLASS_OPTIONS = ['universal', 'caudillo', 'arcanista', 'sombra', 'domador']
const CLASS_LABELS = { universal: 'Universales', caudillo: 'Caudillo', arcanista: 'Arcanista', sombra: 'Sombra', domador: 'Domador' }

function CatalogDebug() {
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('caudillo')

  useEffect(() => {
    supabase.from('item_catalog').select('*').order('slot').order('tier').order('rarity')
      .then(({ data }) => setItems(data ?? []))
  }, [])

  if (!items) return <p style={{ padding: 40, color: '#94a3b8' }}>Cargando catálogo...</p>

  const classFiltered = items.filter(i =>
    classFilter === 'universal'
      ? !i.required_class
      : i.required_class === classFilter
  )
  const slots = filter === 'all' ? SLOT_ORDER : [filter]
  const grouped = slots.reduce((acc, slot) => {
    acc[slot] = classFiltered.filter(i => i.slot === slot)
    return acc
  }, {})

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Catálogo de ítems</h2>
        <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>DEV ONLY</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{classFiltered.length} items</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {CLASS_OPTIONS.map(c => (
          <button key={c} onClick={() => setClassFilter(c)} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid',
            borderColor: classFilter === c ? '#7c3aed' : '#e2e8f0',
            background: classFilter === c ? '#f5f3ff' : 'white',
            color: classFilter === c ? '#7c3aed' : '#475569',
            fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>{CLASS_LABELS[c]}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', ...SLOT_ORDER].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid',
            borderColor: filter === s ? '#2563eb' : '#e2e8f0',
            background: filter === s ? '#eff6ff' : 'white',
            color: filter === s ? '#2563eb' : '#475569',
            fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>{SLOT_LABELS[s]}</button>
        ))}
      </div>

      {slots.map(slot => grouped[slot].length > 0 && (
        <div key={slot} style={{ marginBottom: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 8 }}>{SLOT_LABELS[slot]}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#f8fafc', fontSize: 11 }}>
                {['Nombre','Tier','Rareza','2M','Atq','Def','HP','Fue','Agi','Int','Dur'].map(h => (
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

/* ─── DEV ONLY: Catálogo de tácticas ────────────────────────────────────────── */

const TCAT_COLORS = {
  common: '#6b7280', uncommon: '#16a34a', rare: '#2563eb', epic: '#7c3aed', legendary: '#d97706',
}
const TCAT_RARITY_LABELS = {
  common: 'Común', uncommon: 'Poco Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
}
const TCAT_CATEGORY_LABELS = {
  offensive: 'Ofensiva', defensive: 'Defensiva', tactical: 'Táctica', utility: 'Utilidad',
}
const TCAT_CATEGORY_COLORS = {
  offensive: '#dc2626', defensive: '#2563eb', tactical: '#7c3aed', utility: '#16a34a',
}
const TCAT_STAT_LABELS = {
  attack: 'ATQ', defense: 'DEF', max_hp: 'HP',
  strength: 'FUE', agility: 'AGI', intelligence: 'INT',
}
const TCAT_CATEGORY_ORDER = ['offensive', 'defensive', 'tactical', 'utility']
const TCAT_MAX_LEVEL = 5

const TCAT_TRIGGER_LABELS = {
  passive:          'Pasivo',
  start_of_combat:  'Inicio combate',
  round_n:          'Ronda N',
  hp_below_pct:     'HP bajo %',
  on_crit:          'Al criticar',
  on_dodge:         'Al esquivar',
}
const TCAT_EFFECT_LABELS = {
  damage_mult:          'Daño ×mult',
  damage_mult_next:     'Próx. ataque ×mult',
  first_hit_mult:       '1er golpe ×mult',
  damage_reduction:     'Reducción daño',
  dot_damage:           'Daño por turno',
  lifesteal:            'Robo de vida',
  heal_pct:             'Curación % HP',
  reflect_damage:       'Reflejo daño',
  absorb_shield:        'Escudo absorbente',
  guaranteed_crit:      'Crítico garantizado',
  guaranteed_crit_next: 'Próx. crítico guar.',
  guaranteed_dodge:     'Esquiva garantizada',
  double_attack:        'Doble ataque',
  counter_attack:       'Contraataque',
  armor_pen_boost:      'Penetración armadura',
  dodge_boost:          'Bonus esquiva',
  enemy_debuff:         'Debuff enemigo',
  stat_buff:            'Buff de stats',
  all_stats_pct:        'Todas stats %',
  stealth:              'Sigilo',
  mirror_stance:        'Postura espejo',
  pure_magic_burst:     'Explosión mágica',
  bonus_magic_damage:   'Daño mágico extra',
  reduce_crit_damage:   'Reducir daño crítico',
}

function scaledFx(base, level) { return base * (1 + (level - 1) * 0.15) }
function fmtFxTcat(effect, base, level) {
  const v = scaledFx(base, level)
  if (['damage_mult', 'damage_mult_next', 'first_hit_mult'].includes(effect)) return `×${v.toFixed(2)}`
  return `${Math.round(v * 100)}%`
}

function TacticCatalogDebug() {
  const [tactics, setTactics] = useState(null)
  const [catFilter, setCatFilter] = useState('all')

  useEffect(() => {
    supabase.from('tactic_catalog').select('*').order('category').order('rarity')
      .then(({ data }) => setTactics(data ?? []))
  }, [])

  if (!tactics) return <p style={{ padding: 40, color: '#94a3b8' }}>Cargando catálogo...</p>

  const filtered = catFilter === 'all' ? tactics : tactics.filter(t => t.category === catFilter)
  const byCategory = TCAT_CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = filtered.filter(t => t.category === cat)
    return acc
  }, {})

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Catálogo de tácticas</h2>
        <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>DEV ONLY</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} tácticas</span>
      </div>

      {/* Filtro categoría */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', ...TCAT_CATEGORY_ORDER].map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{
            padding: '3px 10px', borderRadius: 6, border: '1px solid',
            borderColor: catFilter === c ? '#7c3aed' : '#e2e8f0',
            background: catFilter === c ? '#f5f3ff' : 'white',
            color: catFilter === c ? '#7c3aed' : '#475569',
            fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>{c === 'all' ? 'Todas' : TCAT_CATEGORY_LABELS[c]}</button>
        ))}
      </div>

      {TCAT_CATEGORY_ORDER.map(cat => {
        const rows = byCategory[cat]
        if (!rows?.length) return null
        return (
          <div key={cat} style={{ marginBottom: 32 }}>
            <p style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: TCAT_CATEGORY_COLORS[cat], marginBottom: 8 }}>
              {TCAT_CATEGORY_LABELS[cat]}
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#f8fafc', fontSize: 11 }}>
                  {['', 'Nombre', 'Rareza', 'Stat bonuses (Nv1→6)', 'Efecto combate (Nv1→6)'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(t => {
                  const rarColor = TCAT_COLORS[t.rarity] ?? '#6b7280'
                  const bonuses = Array.isArray(t.stat_bonuses) ? t.stat_bonuses.filter(b => b.value) : []
                  const fx = t.combat_effect
                  const levels = [1, 2, 3, 4, 5, 6]
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', fontSize: 18 }}>{t.icon}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: rarColor }}>{t.name}</td>
                      <td style={{ padding: '6px 10px', color: rarColor, whiteSpace: 'nowrap' }}>{TCAT_RARITY_LABELS[t.rarity]}</td>
                      <td style={{ padding: '6px 10px' }}>
                        {bonuses.length === 0 ? <span style={{ color: '#94a3b8' }}>—</span> : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {bonuses.map(b => (
                              <span key={b.stat} style={{ color: '#334155' }}>
                                {TCAT_STAT_LABELS[b.stat] ?? b.stat}:{' '}
                                {levels.map((lv, i) => (
                                  <span key={lv}>
                                    <span style={{ fontWeight: lv === 1 ? 400 : 600, color: lv === 1 ? '#64748b' : '#1e293b' }}>+{b.value * lv}</span>
                                    {i < levels.length - 1 && <span style={{ color: '#cbd5e1' }}> / </span>}
                                  </span>
                                ))}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        {!fx ? <span style={{ color: '#94a3b8' }}>—</span> : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ color: '#64748b', fontSize: 11 }}>{TCAT_TRIGGER_LABELS[fx.trigger] ?? fx.trigger}{fx.n != null ? ` ${fx.n}` : ''} · {TCAT_EFFECT_LABELS[fx.effect] ?? fx.effect}</span>
                            {fx.value != null && !['guaranteed_crit', 'double_attack', 'guaranteed_dodge'].includes(fx.effect) ? (
                              <span style={{ color: '#334155' }}>
                                {levels.map((lv, i) => (
                                  <span key={lv}>
                                    <span style={{ fontWeight: lv === 1 ? 400 : 600, color: lv === 1 ? '#64748b' : '#1e293b' }}>{fmtFxTcat(fx.effect, fx.value, lv)}</span>
                                    {i < levels.length - 1 && <span style={{ color: '#cbd5e1' }}> / </span>}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: 11 }}>binario (+15%/nv)</span>
                            )}
                            {fx.chance != null && <span style={{ color: '#94a3b8', fontSize: 11 }}>chance: {Math.round(fx.chance * 100)}%</span>}
                            {fx.threshold != null && <span style={{ color: '#94a3b8', fontSize: 11 }}>threshold: {Math.round(fx.threshold * 100)}%</span>}
                            {fx.duration && fx.duration < 99 && <span style={{ color: '#94a3b8', fontSize: 11 }}>dur: {fx.duration}t</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Estado del héroe respecto a EXPEDICIONES.
 *   'ready'     → expedición terminada esperando recoger
 *   'exploring' → expedición en curso
 *   'idle'      → ninguna activa
 */
function getHeroExpeditionState(hero, now) {
  const active = hero.expeditions?.find(e => e.status === 'traveling')
  if (!active) return 'idle'
  if (new Date(active.ends_at) <= now) return 'ready'
  return 'exploring'
}

const NAV_ITEMS = [
  { id: 'base',   label: 'Base',     icon: Castle, minHeroes: 0 },
  { id: 'heroes', label: 'Héroes',   icon: Sword,  minHeroes: 0 },
  { id: 'mundo',  label: 'Combates', icon: Globe,  minHeroes: 0 },
  { id: 'arena',  label: 'Arena',    icon: Swords,  minHeroes: 0 },
  { id: 'logros', label: 'Logros',   icon: Trophy,  minHeroes: 0 },
]

const HERO_SUB_TABS = [
  { id: 'ficha',          label: 'Ficha',          icon: Sword       },
  { id: 'equipo',         label: 'Equipo',         icon: Shield      },
  { id: 'tacticas',       label: 'Tácticas',       icon: Layers      },
  { id: 'expediciones',   label: 'Expediciones',   icon: Map         },
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
  const { buildings: _buildings }    = useBuildings(session.user.id)
  const heroId                       = useHeroId()
  const { research: _research }      = useResearch(session.user.id)
  const usedSlots   = heroes.map(h => h.slot ?? 1)
  const nextHeroSlot = [1, 2, 3, 4, 5].find(s => !usedSlots.includes(s)) ?? null
  const { missions }                = useMissions()
  const { refiningSlots: _refiningSlots } = useCraftedItems(session.user.id)
  useRealtimeSync(session.user.id, heroId)
  useComebackBonus(session.user.id)
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

  // Dots del sub-nav: reflejan SOLO el héroe seleccionado (no "algún héroe")
  const selectedHero       = heroes.find(h => h.id === heroId) ?? null
  const selExpState        = selectedHero ? getHeroExpeditionState(selectedHero, now) : 'idle'
  const selExpReady        = selExpState === 'ready'
  const selExpExploring    = selExpState === 'exploring'

  const missionsClaimable = (missions ?? []).filter(m => m.completed && !m.claimed).length

  const baseHasAlert = useMemo(() => {
    const productionReady = (_buildings ?? []).some(b => {
      if (!PRODUCTION_BUILDING_TYPES.includes(b.type) || !b.unlocked || b.level <= 0) return false
      const { rate, cap } = buildingRate(b.type, b.level)
      const elapsed = Math.max(0, (now.getTime() - new Date(b.production_collected_at).getTime()) / 3_600_000)
      return Math.floor(rate * elapsed) >= cap
    })
    const labReady = (_refiningSlots ?? []).some(slot => {
      const elapsed = Date.now() - new Date(slot.craft_started_at).getTime()
      const completed = Math.min(slot.quantity, Math.floor(elapsed / slot.unit_duration_ms))
      return completed >= slot.quantity
    })
    return productionReady || labReady
  }, [_buildings, _refiningSlots, now])

  const navAlerts = { base: baseHasAlert, heroes: selExpReady }

  const heroCount = heroes?.length ?? 0
  const visibleNavItems = NAV_ITEMS.filter(n => heroCount >= (n.minHeroes ?? 0))

  const isMobileDrawer = typeof window !== 'undefined' && window.innerWidth <= 600

  async function handleLogout() { await supabase.auth.signOut() }

  return (
    <div className="h-dvh flex flex-col world-bg overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 glass-header sticky top-0 z-[100] flex-shrink-0">
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <svg width="22" height="26" viewBox="120 40 272 400" className="flex-shrink-0">
            <polygon points="256,52 237,220 275,220" fill="#2563eb" />
            <line x1="256" y1="60" x2="256" y2="212" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
            <rect x="142" y="220" width="228" height="30" rx="15" fill="#2563eb" />
            <circle cx="142" cy="235" r="20" fill="#2563eb" />
            <circle cx="370" cy="235" r="20" fill="#2563eb" />
            <rect x="241" y="250" width="30" height="108" rx="15" fill="#2563eb" />
            <line x1="241" y1="277" x2="271" y2="277" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <line x1="241" y1="303" x2="271" y2="303" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <line x1="241" y1="329" x2="271" y2="329" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <polygon points="256,361 292,394 256,427 220,394" fill="#2563eb" />
            <polygon points="256,371 282,394 256,417 230,394" fill="#2563eb" opacity="0.5" />
          </svg>
          <span
            className="font-display text-[28px] tracking-[0.1em] leading-none"
            style={{
              background: 'linear-gradient(180deg, #2563eb 46%, transparent 46%, transparent 49%, #2563eb 49%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            RPG LEGENDS
          </span>
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
        <aside className="hidden md:flex w-[220px] flex-shrink-0 glass-sidebar border-r-0 flex-col p-4 pt-4 px-3 overflow-y-auto self-stretch">
          <nav className="flex flex-col gap-1">
            {visibleNavItems.map(({ id, label, icon: Icon, accent }) => {
              const isActive = activeTab === id
              const iconColor = isActive ? 'var(--blue-700)' : (accent ?? undefined)
              const hasAlert = !isActive && (navAlerts[id] ?? false)
              return (
                <button
                  key={id}
                  className={`flex items-center gap-3 px-3 py-[10px] rounded-lg border-0 bg-transparent text-[14px] font-medium text-left transition-[background,color] duration-150 w-full relative
                    ${isActive
                      ? 'text-[var(--blue-700)] font-semibold hover:bg-transparent'
                      : 'text-text-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-text'
                    }`}
                  onClick={() => navigateTo(id)}
                >
                  {isActive && (
                    <motion.span
                      className="absolute inset-0 rounded-lg nav-active-indicator z-0"
                      layoutId="nav-indicator"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-[1] w-5 h-5 flex items-center justify-center flex-shrink-0" style={iconColor ? { color: iconColor } : undefined}>
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="relative z-[1] leading-none">{label}</span>
                  {hasAlert && (
                    <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-nav-badge-pulse flex-shrink-0 ml-auto relative z-[1]" />
                  )}
                </button>
              )
            })}
            <div className="sidebar-separator mt-auto" />
            <a
              href="https://discord.gg/WKeRr7m5"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-[10px] rounded-lg text-[14px] font-medium text-text-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-text transition-[background,color] duration-150"
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
                  className={`flex items-center gap-3 px-3 py-[10px] rounded-lg border-0 bg-transparent text-[14px] font-medium text-left transition-[background,color] duration-150 w-full relative opacity-50 ${activeTab === 'dev-tacticas' ? 'text-[var(--blue-700)] font-semibold' : 'text-text-2 hover:bg-bg hover:text-text'}`}
                  onClick={() => navigateTo('dev-tacticas')}
                >
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0"><Layers size={18} strokeWidth={1.8} /></span>
                  <span className="leading-none">Tácticas</span>
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
                {/* Selector de héroe + sub-nav agrupados */}
                <div className="flex flex-col gap-1">
                <HeroSelector />
                {/* Sub-nav */}
                <div className="border-b border-border">
                <ScrollHint activeKey={activeHeroTab}>
                  {HERO_SUB_TABS.map(({ id, label, icon: Icon }) => {
                    const isActive = activeHeroTab === id
                    const hasAlert =
                      (id === 'expediciones' && selExpReady)
                    const hasExploring =
                      (id === 'expediciones' && !selExpReady && selExpExploring)
                    return (
                      <button
                        key={id}
                        data-scroll-key={id}
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
                </ScrollHint>
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
                    {activeHeroTab === 'ficha'         && <ErrorBoundary><Hero /></ErrorBoundary>}
                    {activeHeroTab === 'equipo'        && <ErrorBoundary><Equipo /></ErrorBoundary>}
                    {activeHeroTab === 'entrenamiento' && <ErrorBoundary><Entrenamiento /></ErrorBoundary>}
                    {activeHeroTab === 'tacticas'      && <ErrorBoundary><Tacticas /></ErrorBoundary>}
                    {activeHeroTab === 'expediciones'  && <ErrorBoundary><Dungeons /></ErrorBoundary>}
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
            {mountedTabs.has('mundo') && (
              <div className="flex flex-col gap-1">
                <HeroSelector />
                <ErrorBoundary><Combates key={mundoKey.current} /></ErrorBoundary>
              </div>
            )}
          </div>

          <div className={activeTab === 'logros' ? 'block animate-section-in' : 'hidden'}>
            {mountedTabs.has('logros') && <ErrorBoundary><Logros /></ErrorBoundary>}
          </div>

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
              <div className={activeTab === 'dev-tacticas' ? 'block animate-section-in' : 'hidden'}>
                {mountedTabs.has('dev-tacticas') && <TacticCatalogDebug />}
              </div>
            </>
          )}

          {/* Spacer: compensates for fixed bottom nav on mobile (including iPhone safe area) */}
          <div className="md:hidden flex-shrink-0" style={{ height: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }} aria-hidden="true" />

        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 glass-nav z-[100]" style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '4rem' }}>
        {visibleNavItems.map(({ id, label, icon: Icon, accent }) => {
          const isActive = activeTab === id
          const iconColor = isActive ? 'var(--blue-600)' : (accent ?? undefined)
          const hasAlert = !isActive && (navAlerts[id] ?? false)
          return (
            <button
              key={id}
              className={`flex-1 flex flex-col items-center justify-center gap-1 border-0 bg-transparent text-[11px] font-medium transition-[color,background] duration-150 py-2 px-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]
                ${isActive ? 'text-[var(--blue-600)] font-semibold' : 'text-text-3'}`}
              onClick={() => navigateTo(id)}
            >
              <span className="relative w-[22px] h-[22px] flex items-center justify-center" style={iconColor ? { color: iconColor } : undefined}>
                <Icon size={20} strokeWidth={1.8} />
                {hasAlert && (
                  <span className="absolute -top-[2px] -right-[2px] w-2 h-2 rounded-full bg-[#16a34a] animate-nav-badge-pulse" />
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
          className="flex-1 flex flex-col items-center justify-center gap-1 border-0 bg-transparent text-[11px] font-medium text-text-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-[color,background] duration-150 py-2 px-1"
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

      {recruitOpen && nextHeroSlot && (
        <RecruitModal
          nextSlot={nextHeroSlot}
          onRecruit={() => setRecruitOpen(false)}
          onClose={() => setRecruitOpen(false)}
        />
      )}

    </div>
  )
}

export default Dashboard
