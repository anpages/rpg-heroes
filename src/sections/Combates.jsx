import { useState } from 'react'
import { TowerControl, Trophy, Swords, ChevronRight } from 'lucide-react'
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

export default function Combates({ userId, heroId, onResourceChange }) {
  const [tab, setTab] = useState('torre')

  return (
    <div className="combates-section">

      {/* Header */}
      <div className="combates-header">
        <div className="combates-header-title">
          <Swords size={22} strokeWidth={1.6} />
          <span>Combates</span>
        </div>
        <p className="combates-header-sub">Pon a prueba a tu héroe en combate o consulta la clasificación.</p>
      </div>

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
          {tab === 'torre'         && <Torre userId={userId} heroId={heroId} onResourceChange={onResourceChange} />}
          {tab === 'clasificacion' && <Ranking userId={userId} />}
        </motion.div>
      </AnimatePresence>

    </div>
  )
}
