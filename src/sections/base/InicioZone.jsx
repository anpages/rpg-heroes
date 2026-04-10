import { Pickaxe, Dumbbell, FlaskConical, BookOpen, ChevronRight, Wrench } from 'lucide-react'
import { motion } from 'framer-motion'
import { hasReadyPoint } from '../../hooks/useTraining.js'
import { RESEARCH_NODES } from '../../lib/gameConstants.js'
import { cardVariants, BUILDING_META } from './constants.js'
import { fmtCountdown } from './helpers.js'

export default function InicioZone({ byType, nexusData, trainingRooms, trainingProgress, potions, potionCraftingMap, runeCraftingMap, research, onGoTo }) {
  const progressByStat   = Object.fromEntries(trainingProgress.map(r => [r.stat, r]))
  const builtRooms       = trainingRooms.filter(r => r.built_at !== null)
  const readyRooms       = builtRooms.filter(r => hasReadyPoint(progressByStat[r.stat], r.level))
  const builtCount       = builtRooms.length

  const now = new Date()

  const labLevel    = byType['laboratory']?.level ?? 0
  const labUnlocked = byType['laboratory']?.unlocked !== false && labLevel > 0
  const potionCount = potions.reduce((s, p) => s + (p.quantity ?? 0), 0)

  const activePotionCrafts = Object.values(potionCraftingMap ?? {}).filter(c => new Date(c.craft_ends_at) > now)
  const readyPotionCrafts  = Object.values(potionCraftingMap ?? {}).filter(c => new Date(c.craft_ends_at) <= now)
  const activeRuneCrafts   = Object.values(runeCraftingMap ?? {}).filter(c => new Date(c.craft_ends_at) > now)
  const readyRuneCrafts    = Object.values(runeCraftingMap ?? {}).filter(c => new Date(c.craft_ends_at) <= now)
  const totalCrafting      = activePotionCrafts.length + activeRuneCrafts.length
  const totalReady         = readyPotionCrafts.length + readyRuneCrafts.length

  const libLevel    = byType['library']?.level ?? 0
  const libUnlocked = byType['library']?.unlocked !== false && libLevel > 0

  const trainingRoomsInProgress  = trainingRooms.filter(r => r.building_ends_at && new Date(r.building_ends_at) > now)
  const trainingRoomsDone        = trainingRooms.filter(r => r.built_at === null && r.building_ends_at && new Date(r.building_ends_at) <= now)

  const EXCLUDED_TYPES = ['laboratory', 'library']
  const doneBuilding = Object.values(byType).find(
    b => !EXCLUDED_TYPES.includes(b.type) && b.upgrade_ends_at && new Date(b.upgrade_ends_at) <= now
  )
  const inProgressBuilding = !doneBuilding && Object.values(byType).find(
    b => !EXCLUDED_TYPES.includes(b.type) && b.upgrade_ends_at && new Date(b.upgrade_ends_at) > now
  )

  const activeNode      = research?.active
  const completedCount  = (research?.completed ?? []).length
  const activeNodeMeta  = activeNode ? RESEARCH_NODES.find(n => n.id === activeNode.node_id) : null
  const researchReady   = activeNode && new Date(activeNode.ends_at) <= now

  const labBuilding     = byType['laboratory']
  const labDone         = labBuilding?.upgrade_ends_at && new Date(labBuilding.upgrade_ends_at) <= now
  const labInProgress   = labBuilding?.upgrade_ends_at && new Date(labBuilding.upgrade_ends_at) > now

  const libBuilding     = byType['library']
  const libDone         = libBuilding?.upgrade_ends_at && new Date(libBuilding.upgrade_ends_at) <= now
  const libInProgress   = libBuilding?.upgrade_ends_at && new Date(libBuilding.upgrade_ends_at) > now

  const CARDS = [
    {
      id: 'recursos', color: '#0891b2', Icon: Pickaxe,
      alert: doneBuilding ? 'ready' : inProgressBuilding ? 'active' : null,
      content: (
        <>
          <p className="text-[15px] font-bold text-text">Recursos</p>
          {nexusData && (
            <p className={`text-[13px] font-semibold mt-0.5 ${nexusData.deficit ? 'text-[#dc2626]' : 'text-[#0891b2]'}`}>
              {nexusData.deficit ? `Déficit −${Math.abs(nexusData.balance)} ⚡` : `+${nexusData.balance} ⚡ excedente`}
            </p>
          )}
          {doneBuilding && (
            <p className="flex items-center gap-1 text-[12px] font-bold text-[#16a34a] mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] flex-shrink-0" />
              {BUILDING_META[doneBuilding.type]?.name ?? 'Edificio'} listo
            </p>
          )}
          {inProgressBuilding && !doneBuilding && (
            <p className="flex items-center gap-1 text-[12px] font-semibold text-[#d97706] mt-2">
              <Wrench size={11} strokeWidth={2} />
              {BUILDING_META[inProgressBuilding.type]?.name ?? 'Edificio'} {inProgressBuilding.level === 0 ? 'en construcción' : 'mejorando'}…
            </p>
          )}
        </>
      ),
    },
    {
      id: 'entrenamiento', color: '#dc2626', Icon: Dumbbell,
      alert: (readyRooms.length > 0 || trainingRoomsDone.length > 0) ? 'ready'
           : trainingRoomsInProgress.length > 0 ? 'active'
           : null,
      content: (
        <>
          <p className="text-[15px] font-bold text-text">Entrenamiento</p>
          <p className="text-[13px] text-text-3 mt-0.5">
            {builtCount > 0 ? `${builtCount}/5 sala${builtCount !== 1 ? 's' : ''} activa${builtCount !== 1 ? 's' : ''}` : 'Sin salas construidas'}
          </p>
          {readyRooms.length > 0 && (
            <p className="flex items-center gap-1 text-[12px] font-bold text-[#16a34a] mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] flex-shrink-0" />
              {readyRooms.length} punto{readyRooms.length !== 1 ? 's' : ''} listo{readyRooms.length !== 1 ? 's' : ''} para recoger
            </p>
          )}
          {trainingRoomsDone.length > 0 && readyRooms.length === 0 && (
            <p className="flex items-center gap-1 text-[12px] font-bold text-[#16a34a] mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] flex-shrink-0" />
              {trainingRoomsDone.length > 1 ? 'Salas listas' : 'Sala lista'}
            </p>
          )}
          {trainingRoomsInProgress.length > 0 && readyRooms.length === 0 && trainingRoomsDone.length === 0 && (
            <p className="flex items-center gap-1 text-[12px] font-semibold text-[#d97706] mt-2">
              <Wrench size={11} strokeWidth={2} />
              {trainingRoomsInProgress.length > 1 ? 'Salas construyéndose…' : 'Sala construyéndose…'}
            </p>
          )}
          {builtCount === 0 && trainingRoomsInProgress.length === 0 && trainingRoomsDone.length === 0 && (
            <p className="text-[12px] text-text-3 mt-2">Construye tu primera sala</p>
          )}
        </>
      ),
    },
    {
      id: 'laboratorio', color: '#7c3aed', Icon: FlaskConical,
      alert: (labDone || totalReady > 0) ? 'ready' : (labInProgress || totalCrafting > 0) ? 'active' : null,
      content: (
        <>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-bold text-text">Laboratorio</p>
            {labUnlocked && (
              <span className="text-[11px] font-bold px-1.5 py-[2px] rounded-md leading-none"
                style={{ color: '#7c3aed', background: 'color-mix(in srgb,#7c3aed 12%,var(--surface))' }}>
                Nv.{labLevel}
              </span>
            )}
          </div>
          {labDone && (
            <p className="flex items-center gap-1 text-[12px] font-bold text-[#16a34a] mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] flex-shrink-0" />
              Laboratorio listo
            </p>
          )}
          {labInProgress && (
            <p className="flex items-center gap-1 text-[12px] font-semibold text-[#d97706] mt-1">
              <Wrench size={11} strokeWidth={2} />
              {labLevel === 0 ? 'En construcción' : 'Mejorando'}…
            </p>
          )}
          {labUnlocked && !labDone && !labInProgress && (
            <>
              {totalReady > 0 && (
                <p className="flex items-center gap-1 text-[12px] font-bold text-[#16a34a] mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] flex-shrink-0" />
                  {totalReady} crafteo{totalReady !== 1 ? 's' : ''} listo{totalReady !== 1 ? 's' : ''}
                </p>
              )}
              {totalCrafting > 0 && (
                <p className="flex items-center gap-1 text-[12px] font-semibold text-[#d97706] mt-1">
                  <Wrench size={11} strokeWidth={2} />
                  {totalCrafting} crafteando…
                </p>
              )}
              {totalReady === 0 && totalCrafting === 0 && (
                <p className="text-[13px] text-text-3 mt-0.5">
                  {potionCount > 0 ? `${potionCount} pociones en stock` : 'Sin pociones'}
                </p>
              )}
            </>
          )}
          {!labUnlocked && !labDone && !labInProgress && (
            <p className="text-[13px] text-text-3 mt-0.5">Sin construir</p>
          )}
        </>
      ),
    },
    {
      id: 'biblioteca', color: '#d97706', Icon: BookOpen,
      alert: (researchReady || libDone) ? 'ready' : (activeNode && !researchReady) || libInProgress ? 'active' : null,
      content: (
        <>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-bold text-text">Biblioteca</p>
            {libUnlocked && (
              <span className="text-[11px] font-bold px-1.5 py-[2px] rounded-md leading-none"
                style={{ color: '#d97706', background: 'color-mix(in srgb,#d97706 12%,var(--surface))' }}>
                Nv.{libLevel}
              </span>
            )}
          </div>
          {libDone && (
            <p className="flex items-center gap-1 text-[12px] font-bold text-[#16a34a] mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] flex-shrink-0" />
              Biblioteca lista
            </p>
          )}
          {libInProgress && (
            <p className="flex items-center gap-1 text-[12px] font-semibold text-[#d97706] mt-1">
              <Wrench size={11} strokeWidth={2} />
              {libLevel === 0 ? 'En construcción' : 'Mejorando'}…
            </p>
          )}
          {libUnlocked && !libDone && !libInProgress && (
            activeNode ? (
              <>
                <p className="text-[12px] text-text-3 mt-0.5 truncate">{activeNodeMeta?.name ?? 'Investigando…'}</p>
                {researchReady ? (
                  <p className="flex items-center gap-1 text-[12px] font-bold text-[#16a34a] mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] flex-shrink-0" />
                    Investigación lista
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-[12px] font-semibold text-[#d97706] mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d97706] flex-shrink-0" />
                    {fmtCountdown(activeNode.ends_at)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13px] text-text-3 mt-0.5">Sin investigación activa</p>
            )
          )}
          {!libUnlocked && !libDone && !libInProgress && (
            <p className="text-[13px] text-text-3 mt-0.5">Sin construir</p>
          )}
          {libUnlocked && (
            <p className="text-[11px] text-text-3 mt-1.5">{completedCount}/16 nodos completados</p>
          )}
        </>
      ),
    },
  ]

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARDS.map(({ id, color, Icon, alert, content }) => (
          <button
            key={id}
            onClick={() => onGoTo(id)}
            className="text-left flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 hover:border-border-2 hover:shadow-[var(--shadow-md)] transition-[border-color,box-shadow] duration-200"
          >
            <div className="flex items-center justify-between">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `color-mix(in srgb,${color} 12%,var(--surface-2))` }}
              >
                <Icon size={17} strokeWidth={2} style={{ color }} />
              </div>
              {alert && (
                <span className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${alert === 'ready' ? 'bg-[#16a34a]' : 'bg-[#d97706]'}`} />
              )}
            </div>
            <div className="flex-1">{content}</div>
            <span className="text-[11px] font-semibold text-text-3 flex items-center gap-1 mt-auto">
              Ver todo <ChevronRight size={10} strokeWidth={2.5} />
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
