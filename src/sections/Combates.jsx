import { useState } from 'react'
import { TowerControl, Trophy, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Torre from './Torre'
import Ranking from './Ranking'

const MODES = [
  {
    id:          'torre',
    label:       'Torre',
    sublabel:    'PvE',
    description: 'Asciende planta a planta. Cada piso es más difícil. ¿Hasta dónde llegarás?',
    Icon:        TowerControl,
    color:       '#2563eb',
  },
  {
    id:          'clasificacion',
    label:       'Clasificación',
    sublabel:    'Global',
    description: 'Los héroes más poderosos del reino, ordenados por nivel y progreso.',
    Icon:        Trophy,
    color:       '#d97706',
  },
]

export default function Combates() {
  const [tab, setTab] = useState('torre')

  return (
    <div className="flex flex-col gap-6">

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {MODES.map(m => {
          const active = tab === m.id
          return (
            <button
              key={m.id}
              className={`group relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3.5 p-3 sm:px-[18px] sm:py-4 bg-surface border-[1.5px] rounded-[14px] cursor-pointer text-left transition-[border-color,background,box-shadow] duration-[180ms] shadow-[var(--shadow-sm)] font-[inherit] w-full
                ${active
                  ? 'border-[var(--mode-color)] bg-[color-mix(in_srgb,var(--mode-color)_6%,var(--surface))] shadow-[0_0_0_1px_var(--mode-color),var(--shadow-sm)]'
                  : 'border-border hover:border-[color-mix(in_srgb,var(--mode-color)_40%,var(--border))] hover:shadow-[var(--shadow-md)]'
                }`}
              style={{ '--mode-color': m.color }}
              onClick={() => setTab(m.id)}
            >
              {/* Overlay tint */}
              <div className={`absolute inset-0 bg-[var(--mode-color)] pointer-events-none transition-opacity duration-[180ms] ${active ? 'opacity-[0.05]' : 'opacity-0 group-hover:opacity-[0.04]'}`} />

              {/* Icon */}
              <div className={`relative w-[38px] h-[38px] sm:w-12 sm:h-12 rounded-[9px] sm:rounded-[12px] flex items-center justify-center text-[var(--mode-color)] flex-shrink-0 transition-[background] duration-[180ms]
                ${active
                  ? 'bg-[color-mix(in_srgb,var(--mode-color)_18%,var(--surface-2))]'
                  : 'bg-[color-mix(in_srgb,var(--mode-color)_12%,var(--surface-2))]'
                } border border-[color-mix(in_srgb,var(--mode-color)_25%,var(--border))]`}>
                <m.Icon size={26} strokeWidth={1.6} />
              </div>

              {/* Info */}
              <div className="relative flex-1 min-w-0">
                <div className="flex items-baseline gap-[7px] mb-1">
                  <span className={`font-['Rajdhani',sans-serif] text-[15px] sm:text-[17px] font-bold tracking-[0.02em] transition-colors duration-[180ms] ${active ? 'text-[var(--mode-color)]' : 'text-text'}`}>
                    {m.label}
                  </span>
                  <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--mode-color)] bg-[color-mix(in_srgb,var(--mode-color)_12%,var(--surface-2))] border border-[color-mix(in_srgb,var(--mode-color)_25%,var(--border))] px-1.5 py-px rounded-[4px]">
                    {m.sublabel}
                  </span>
                </div>
                <p className="hidden sm:block text-[12px] text-text-3 leading-[1.4] line-clamp-2">
                  {m.description}
                </p>
              </div>

              {/* Arrow */}
              <ChevronRight
                size={16}
                strokeWidth={2}
                className={`relative hidden sm:block flex-shrink-0 transition-[color,transform] duration-[180ms] ${active ? 'text-[var(--mode-color)] translate-x-0.5' : 'text-text-3 group-hover:text-[var(--mode-color)] group-hover:translate-x-0.5'}`}
              />
            </button>
          )
        })}
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
          {tab === 'torre'         && <Torre />}
          {tab === 'clasificacion' && <Ranking />}
        </motion.div>
      </AnimatePresence>

    </div>
  )
}
