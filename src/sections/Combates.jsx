import { Scroll, Swords, Trophy, Zap, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ScrollHint from '../components/ScrollHint'
import { useAppStore } from '../store/appStore'
import QuickCombat from './QuickCombat'
import TeamCombat from './TeamCombat'
import CombatHistorial from './CombatHistorial'
import Torneos from './Torneos'
import Ranking from './Ranking'

const MODES = [
  { id: 'practica',       label: 'C. Rápido',      sublabel: 'PvE',      Icon: Zap,          color: '#10b981' },
  { id: '3v3',            label: '3v3',            sublabel: 'Equipo',   Icon: Users,        color: '#2563eb' },
  { id: '5v5',            label: '5v5',            sublabel: 'Equipo',   Icon: Users,        color: '#7c3aed' },
  { id: 'torneos',        label: 'Torneo',         sublabel: 'PvE',      Icon: Swords,       color: '#dc2626' },
  { id: 'historial',      label: 'Historial',      sublabel: 'Combates', Icon: Scroll,       color: '#a855f7' },
  { id: 'clasificacion',  label: 'Clasificación',  sublabel: 'Global',   Icon: Trophy,       color: '#d97706' },
]

export default function Combates() {
  const tab    = useAppStore(s => s.activeWorldTab)
  const setTab = useAppStore(s => s.navigateToWorldTab)

  return (
    <div className="flex flex-col gap-6">

      {/* Mode selector */}
      <div className="border-b border-border">
      <ScrollHint activeKey={tab}>
        {MODES.map(m => {
          const active = tab === m.id
          return (
            <button
              key={m.id}
              data-scroll-key={m.id}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap transition-[color,border-color] duration-150 bg-transparent border-x-0 border-t-0 font-[inherit] cursor-pointer flex-shrink-0"
              style={{
                borderBottomColor: active ? m.color : 'transparent',
                color: active ? m.color : 'var(--text-3)',
              }}
              onClick={() => setTab(m.id)}
            >
              <m.Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
              {m.label}
              <span
                className="text-[10px] font-bold tracking-[0.08em] uppercase px-1.5 py-px rounded-[4px] border"
                style={{
                  color: active ? m.color : 'var(--text-3)',
                  background: active ? `color-mix(in srgb,${m.color} 10%,var(--surface-2))` : 'var(--surface-2)',
                  borderColor: active ? `color-mix(in srgb,${m.color} 30%,var(--border))` : 'var(--border)',
                }}
              >
                {m.sublabel}
              </span>
            </button>
          )
        })}
      </ScrollHint>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'practica'      && <QuickCombat />}
          {tab === '3v3'           && <TeamCombat size={3} />}
          {tab === '5v5'           && <TeamCombat size={5} />}
          {tab === 'torneos'       && <Torneos />}
          {tab === 'historial'     && <CombatHistorial />}
          {tab === 'clasificacion' && <Ranking />}
        </motion.div>
      </AnimatePresence>

    </div>
  )
}
