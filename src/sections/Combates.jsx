import { useState } from 'react'
import { TowerControl, Trophy } from 'lucide-react'
import Torre from './Torre'
import Ranking from './Ranking'
import './Combates.css'

const TABS = [
  { id: 'torre',         label: 'Torre',          Icon: TowerControl },
  { id: 'clasificacion', label: 'Clasificación',  Icon: Trophy       },
]

export default function Combates({ userId, heroId, onResourceChange }) {
  const [tab, setTab] = useState('torre')

  return (
    <div className="combates-section">
      <div className="combates-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`combates-tab ${tab === id ? 'combates-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={15} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      <div className="combates-content">
        {tab === 'torre'         && <Torre userId={userId} heroId={heroId} onResourceChange={onResourceChange} />}
        {tab === 'clasificacion' && <Ranking userId={userId} />}
      </div>
    </div>
  )
}
