import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useResources } from '../hooks/useResources'
import { useTrainingRooms } from '../hooks/useTrainingRooms'
import { useTraining } from '../hooks/useTraining'
import { CLASS_TRAINING_STATS } from '../lib/gameConstants'
import EntrenamientoZone from './base/EntrenamientoZone.jsx'

export default function Entrenamiento() {
  const userId  = useAppStore(s => s.userId)
  const heroId  = useHeroId()

  const { hero }                             = useHero(heroId)
  const { resources }                        = useResources(userId)
  const { rooms: trainingRooms }             = useTrainingRooms(userId)
  const { rows: trainingProgress }           = useTraining(heroId)

  if (!hero) return (
    <div className="text-text-3 text-[15px] p-10 text-center">
      {heroId ? 'No se encontró el héroe.' : 'Recluta tu primer héroe para comenzar.'}
    </div>
  )

  const now                  = new Date()
  const anyTrainingUpgrading = (trainingRooms ?? []).some(r => r.building_ends_at && new Date(r.building_ends_at) > now)
  const allowedStats         = CLASS_TRAINING_STATS[hero.class]

  return (
    <EntrenamientoZone
      trainingRooms={trainingRooms ?? []}
      trainingProgress={trainingProgress ?? []}
      resources={resources}
      userId={userId}
      heroId={hero.id}
      heroLevel={hero.level ?? 1}
      anyUpgrading={anyTrainingUpgrading}
      allowedStats={allowedStats}
      hero={hero}
    />
  )
}
