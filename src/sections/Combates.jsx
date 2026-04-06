import { useState } from 'react'
import { TowerControl, Trophy, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Torre from './Torre'
import Ranking from './Ranking'
import './Combates.css'

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
    <div className="combates-section">

      {/* Mode selector */}
      <div className="combates-modes">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`combates-mode ${tab === m.id ? 'combates-mode--active' : ''}`}
            style={{ '--mode-color': m.color }}
            onClick={() => setTab(m.id)}
          >
            <div className="combates-mode-icon">
              <m.Icon size={26} strokeWidth={1.6} />
            </div>
            <div className="combates-mode-info">
              <div className="combates-mode-name-row">
                <span className="combates-mode-name">{m.label}</span>
                <span className="combates-mode-sublabel">{m.sublabel}</span>
              </div>
              <p className="combates-mode-desc">{m.description}</p>
            </div>
            <ChevronRight size={16} strokeWidth={2} className="combates-mode-arrow" />
          </button>
        ))}
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
