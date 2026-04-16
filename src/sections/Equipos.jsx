import { motion, AnimatePresence } from 'framer-motion'
import { Users } from 'lucide-react'
import ScrollHint from '../components/ScrollHint'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import TeamCombat from './TeamCombat'

export default function Equipos() {
  const userId       = useAppStore(s => s.userId)
  const tab          = useAppStore(s => s.activeTeamTab)
  const navigateTo   = useAppStore(s => s.navigateToTeamTab)
  const { heroes }   = useHeroes(userId)
  const heroCount    = heroes?.length ?? 0

  const MODES = [
    { id: '3v3', label: '3v3', sublabel: 'Escuadrón', color: '#2563eb', minHeroes: 3 },
    { id: '5v5', label: '5v5', sublabel: 'Gran Equipo', color: '#7c3aed', minHeroes: 5 },
  ].filter(m => heroCount >= m.minHeroes)

  // Si el tab activo ya no está disponible, usar el primero disponible
  const activeTab = MODES.find(m => m.id === tab) ? tab : (MODES[0]?.id ?? '3v3')

  return (
    <div className="flex flex-col gap-6">

      {/* Mode selector */}
      {MODES.length > 1 && (
        <div className="border-b border-border">
          <ScrollHint activeKey={activeTab}>
            {MODES.map(m => {
              const active = activeTab === m.id
              return (
                <button
                  key={m.id}
                  data-scroll-key={m.id}
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap transition-[color,border-color] duration-150 bg-transparent border-x-0 border-t-0 font-[inherit] cursor-pointer flex-shrink-0"
                  style={{
                    borderBottomColor: active ? m.color : 'transparent',
                    color: active ? m.color : 'var(--text-3)',
                  }}
                  onClick={() => navigateTo(m.id)}
                >
                  <Users size={15} strokeWidth={active ? 2.2 : 1.8} />
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
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === '3v3' && <TeamCombat size={3} />}
          {activeTab === '5v5' && <TeamCombat size={5} />}
        </motion.div>
      </AnimatePresence>

    </div>
  )
}
