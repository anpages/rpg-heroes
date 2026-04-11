import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords, Scroll, Trophy } from 'lucide-react'
import ScrollHint from '../components/ScrollHint'
import TeamCombat from './TeamCombat'
import TeamCombatHistorial from './TeamCombatHistorial'
import TeamCombatRanking from './TeamCombatRanking'

const MODES = [
  { id: 'combate',       label: 'Combate',      sublabel: '3v3',   Icon: Swords,  color: '#7c3aed' },
  { id: 'historial',     label: 'Historial',    sublabel: 'Squad', Icon: Scroll,  color: '#a855f7' },
  { id: 'clasificacion', label: 'Clasificación', sublabel: 'Squad', Icon: Trophy,  color: '#d97706' },
]

export default function Escuadron() {
  const [tab, setTab] = useState('combate')

  return (
    <div className="flex flex-col gap-6">
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

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'combate'       && <TeamCombat />}
          {tab === 'historial'     && <TeamCombatHistorial />}
          {tab === 'clasificacion' && <TeamCombatRanking />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
