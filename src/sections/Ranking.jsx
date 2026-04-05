import { useRanking } from '../hooks/useRanking'
import { Trophy, Medal } from 'lucide-react'
import './Ranking.css'


function PositionBadge({ position }) {
  if (position === 1) return <span className="position-badge position-badge--gold"><Trophy size={14} strokeWidth={2} />1</span>
  if (position === 2) return <span className="position-badge position-badge--silver"><Medal size={14} strokeWidth={2} />2</span>
  if (position === 3) return <span className="position-badge position-badge--bronze"><Medal size={14} strokeWidth={2} />3</span>
  return <span className="position-number">{position}</span>
}

function Ranking({ userId }) {
  const { ranking, loading } = useRanking()

  if (loading) return <div className="ranking-loading">Cargando clasificación...</div>

  return (
    <div className="ranking-section">
      <div className="section-header">
        <h2 className="section-title">Clasificación</h2>
        <p className="section-subtitle">Los héroes más poderosos del reino, ordenados por nivel.</p>
      </div>

      <div className="ranking-table">
        <div className="ranking-header-row">
          <span className="col-pos">#</span>
          <span className="col-name">Héroe</span>
          <span className="col-class">Clase</span>
          <span className="col-level">Nivel</span>
        </div>

        {ranking?.length === 0 && (
          <div className="ranking-empty">Aún no hay héroes registrados.</div>
        )}

        {ranking?.map((entry, i) => {
          const position = i + 1
          const isMe = entry.player_id === userId
          const cls = entry.classes

          return (
            <div
              key={entry.player_id}
              className={`ranking-row ${isMe ? 'ranking-row--me' : ''} ${position <= 3 ? 'ranking-row--top' : ''}`}
            >
              <span className="col-pos">
                <PositionBadge position={position} />
              </span>
              <span className="col-name">
                {entry.name}
                {isMe && <span className="me-badge">Tú</span>}
              </span>
              <span className="col-class">
                <span
                  className="class-tag"
                  style={cls ? { '--cls-color': cls.color } : {}}
                >
                  {cls?.name ?? entry.class}
                </span>
              </span>
              <span className="col-level">
                <span className="level-value">Nv. {entry.level}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Ranking
