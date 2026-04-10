import {
  Pickaxe, Dumbbell, FlaskConical, BookOpen, ChevronRight, Wrench,
  Clock, Zap, PackageOpen,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { hasReadyPoint, xpProgress } from '../../hooks/useTraining.js'
import { RESEARCH_NODES } from '../../lib/gameConstants.js'
import { cardVariants, BUILDING_META, TRAINING_ROOMS } from './constants.js'
import { fmtCountdown } from './helpers.js'

/* ── Helpers locales ─────────────────────────────────────────────────────────── */

function AlertDot({ type }) {
  return (
    <span className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${type === 'ready' ? 'bg-[#16a34a]' : 'bg-[#d97706]'}`} />
  )
}

function StatusLine({ icon: Icon, color, children }) {
  return (
    <p className={`flex items-center gap-1.5 text-[13px] font-semibold`} style={{ color }}>
      {Icon && <Icon size={13} strokeWidth={2} className="flex-shrink-0" />}
      {children}
    </p>
  )
}

/* ── Card wrapper ────────────────────────────────────────────────────────────── */

function ZoneCard({ id, color, Icon, alert, children, onGoTo }) {
  return (
    <button
      onClick={() => onGoTo(id)}
      className="text-left flex flex-col rounded-xl border border-border bg-surface hover:border-border-2 hover:shadow-[var(--shadow-md)] transition-[border-color,box-shadow] duration-200 overflow-hidden"
    >
      {/* Accent bar */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(to right, ${color}, transparent)` }} />

      <div className="flex flex-col gap-4 p-5 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb,${color} 12%,var(--surface-2))` }}
            >
              <Icon size={18} strokeWidth={2} style={{ color }} />
            </div>
            <div className="flex flex-col">
              {children[0]}
            </div>
          </div>
          {alert && <AlertDot type={alert} />}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 flex-1">
          {children[1]}
        </div>

        {/* Footer */}
        <span className="text-[12px] font-semibold text-text-3 flex items-center gap-1 mt-auto pt-3 border-t border-border">
          Ver todo <ChevronRight size={11} strokeWidth={2.5} />
        </span>
      </div>
    </button>
  )
}

/* ── Cards individuales ──────────────────────────────────────────────────────── */

function RecursosCard({ byType, nexusData, onGoTo }) {
  const now = new Date()
  const EXCLUDED = ['laboratory', 'library']

  const doneBuilding = Object.values(byType).find(
    b => !EXCLUDED.includes(b.type) && b.upgrade_ends_at && new Date(b.upgrade_ends_at) <= now
  )
  const inProgressBuilding = !doneBuilding && Object.values(byType).find(
    b => !EXCLUDED.includes(b.type) && b.upgrade_ends_at && new Date(b.upgrade_ends_at) > now
  )

  const buildingTypes = ['energy_nexus', 'gold_mine', 'lumber_mill', 'mana_well']

  return (
    <ZoneCard id="recursos" color="#0891b2" Icon={Pickaxe} onGoTo={onGoTo}
      alert={doneBuilding ? 'ready' : inProgressBuilding ? 'active' : null}>
      {/* Header content */}
      <p className="text-[16px] font-bold text-text leading-none">Recursos</p>

      {/* Body content */}
      <>
        {/* Energy balance */}
        {nexusData && (
          <div className="flex items-center gap-2.5">
            <Zap size={14} strokeWidth={2} className="flex-shrink-0" style={{ color: nexusData.deficit ? '#dc2626' : '#0891b2' }} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[13px] font-semibold ${nexusData.deficit ? 'text-[#dc2626]' : 'text-[#0891b2]'}`}>
                  {nexusData.deficit ? `Déficit −${Math.abs(nexusData.balance)}` : `+${nexusData.balance} excedente`}
                </span>
                <span className="text-[11px] text-text-3">{nexusData.consumed}/{nexusData.produced}</span>
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${nexusData.barPct}%`,
                    background: nexusData.deficit ? '#dc2626' : '#0891b2',
                  }} />
              </div>
            </div>
          </div>
        )}

        {/* Building levels mini summary */}
        <div className="flex items-center gap-2 flex-wrap">
          {buildingTypes.map(t => {
            const b = byType[t]
            if (!b || b.level === 0) return null
            const meta = BUILDING_META[t]
            return (
              <span key={t} className="text-[11px] font-bold px-2 py-1 rounded-md leading-none"
                style={{ color: meta.color, background: `color-mix(in srgb,${meta.color} 10%,var(--surface))` }}>
                {meta.name.split(' ')[0]} {b.level}
              </span>
            )
          })}
        </div>

        {/* Alerts */}
        {doneBuilding && (
          <StatusLine icon={PackageOpen} color="#16a34a">
            {BUILDING_META[doneBuilding.type]?.name ?? 'Edificio'} listo
          </StatusLine>
        )}
        {inProgressBuilding && !doneBuilding && (
          <StatusLine icon={Wrench} color="#d97706">
            {BUILDING_META[inProgressBuilding.type]?.name ?? 'Edificio'} {inProgressBuilding.level === 0 ? 'construyendo' : 'mejorando'}…
          </StatusLine>
        )}
      </>
    </ZoneCard>
  )
}

function EntrenamientoCard({ trainingRooms, trainingProgress, onGoTo }) {
  const now = new Date()
  const progressByStat = Object.fromEntries(trainingProgress.map(r => [r.stat, r]))
  const builtRooms = trainingRooms.filter(r => r.built_at !== null)
  const readyRooms = builtRooms.filter(r => hasReadyPoint(progressByStat[r.stat], r.level))
  const constructing = trainingRooms.filter(r => r.building_ends_at && new Date(r.building_ends_at) > now)
  const constructionDone = trainingRooms.filter(r => r.built_at === null && r.building_ends_at && new Date(r.building_ends_at) <= now)

  const alert = (readyRooms.length > 0 || constructionDone.length > 0) ? 'ready'
    : constructing.length > 0 ? 'active'
    : null

  return (
    <ZoneCard id="entrenamiento" color="#dc2626" Icon={Dumbbell} onGoTo={onGoTo} alert={alert}>
      {/* Header */}
      <>
        <p className="text-[16px] font-bold text-text leading-none">Entrenamiento</p>
        <p className="text-[12px] text-text-3 leading-none mt-1">{builtRooms.length}/{TRAINING_ROOMS.length} salas</p>
      </>

      {/* Body */}
      <>
        {/* Mini progress per room */}
        {builtRooms.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {TRAINING_ROOMS.map(room => {
              const rd = trainingRooms.find(r => r.stat === room.stat)
              if (!rd || rd.built_at === null) return null
              const row = progressByStat[room.stat]
              const upgrading = rd.building_ends_at && new Date(rd.building_ends_at) > now
              const ready = hasReadyPoint(row, rd.level)
              const pct = upgrading ? 0 : Math.round(xpProgress(row, rd.level) * 100)

              return (
                <div key={room.stat} className="flex items-center gap-2.5">
                  <room.icon size={13} strokeWidth={2} className="flex-shrink-0" style={{ color: upgrading ? 'var(--text-3)' : room.color }} />
                  <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                    <div className={`h-full rounded-full transition-[width] duration-500 ${upgrading ? 'opacity-30' : ''}`}
                      style={{
                        width: `${upgrading ? 100 : pct}%`,
                        background: upgrading ? 'var(--text-3)' : ready ? '#16a34a' : room.color,
                      }} />
                  </div>
                  {ready && <span className="text-[10px] font-bold text-[#16a34a]">!</span>}
                  {upgrading && <Wrench size={10} strokeWidth={2} className="text-text-3" />}
                </div>
              )
            })}
          </div>
        )}

        {/* Alerts */}
        {readyRooms.length > 0 && (
          <StatusLine icon={PackageOpen} color="#16a34a">
            {readyRooms.length} punto{readyRooms.length !== 1 ? 's' : ''} para recoger
          </StatusLine>
        )}
        {constructionDone.length > 0 && readyRooms.length === 0 && (
          <StatusLine icon={PackageOpen} color="#16a34a">
            {constructionDone.length > 1 ? 'Salas listas' : 'Sala lista'}
          </StatusLine>
        )}
        {constructing.length > 0 && readyRooms.length === 0 && constructionDone.length === 0 && (
          <StatusLine icon={Wrench} color="#d97706">
            {constructing.length > 1 ? 'Salas construyéndose…' : 'Sala construyéndose…'}
          </StatusLine>
        )}
        {builtRooms.length === 0 && constructing.length === 0 && constructionDone.length === 0 && (
          <p className="text-[13px] text-text-3">Construye tu primera sala</p>
        )}
      </>
    </ZoneCard>
  )
}

function LaboratorioCard({ byType, potions, potionCraftingMap, runeCraftingMap, onGoTo }) {
  const now = new Date()
  const labLevel = byType['laboratory']?.level ?? 0
  const labUnlocked = byType['laboratory']?.unlocked !== false && labLevel > 0

  const labBuilding = byType['laboratory']
  const labDone = labBuilding?.upgrade_ends_at && new Date(labBuilding.upgrade_ends_at) <= now
  const labInProgress = labBuilding?.upgrade_ends_at && new Date(labBuilding.upgrade_ends_at) > now

  const activePotionCrafts = Object.values(potionCraftingMap ?? {}).filter(c => new Date(c.craft_ends_at) > now)
  const readyPotionCrafts = Object.values(potionCraftingMap ?? {}).filter(c => new Date(c.craft_ends_at) <= now)
  const activeRuneCrafts = Object.values(runeCraftingMap ?? {}).filter(c => new Date(c.craft_ends_at) > now)
  const readyRuneCrafts = Object.values(runeCraftingMap ?? {}).filter(c => new Date(c.craft_ends_at) <= now)
  const totalCrafting = activePotionCrafts.length + activeRuneCrafts.length
  const totalReady = readyPotionCrafts.length + readyRuneCrafts.length
  const potionCount = potions.reduce((s, p) => s + (p.quantity ?? 0), 0)

  const alert = (labDone || totalReady > 0) ? 'ready' : (labInProgress || totalCrafting > 0) ? 'active' : null

  // Nearest craft completion
  const allActive = [...activePotionCrafts, ...activeRuneCrafts]
  const nearest = allActive.length > 0
    ? allActive.reduce((a, b) => new Date(a.craft_ends_at) < new Date(b.craft_ends_at) ? a : b)
    : null

  return (
    <ZoneCard id="laboratorio" color="#7c3aed" Icon={FlaskConical} onGoTo={onGoTo} alert={alert}>
      {/* Header */}
      <>
        <div className="flex items-center gap-1.5">
          <p className="text-[16px] font-bold text-text leading-none">Laboratorio</p>
          {labUnlocked && (
            <span className="text-[11px] font-bold px-2 py-1 rounded-md leading-none"
              style={{ color: '#7c3aed', background: 'color-mix(in srgb,#7c3aed 12%,var(--surface))' }}>
              Nv.{labLevel}
            </span>
          )}
        </div>
      </>

      {/* Body */}
      <>
        {labDone && (
          <StatusLine icon={PackageOpen} color="#16a34a">Laboratorio listo</StatusLine>
        )}
        {labInProgress && !labDone && (
          <StatusLine icon={Wrench} color="#d97706">
            {labLevel === 0 ? 'Construyendo' : 'Mejorando'}… {fmtCountdown(labBuilding.upgrade_ends_at)}
          </StatusLine>
        )}
        {labUnlocked && !labDone && !labInProgress && (
          <>
            {/* Crafting summary */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[13px] text-text-3">
                <span className="font-semibold text-text">{potionCount}</span> pociones
              </span>
              {totalCrafting > 0 && (
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#d97706]">
                  <Clock size={12} strokeWidth={2} />
                  {totalCrafting} crafteando
                </span>
              )}
            </div>

            {/* Nearest completion */}
            {nearest && (
              <StatusLine icon={Clock} color="#d97706">
                Próximo: {fmtCountdown(nearest.craft_ends_at)}
              </StatusLine>
            )}

            {totalReady > 0 && (
              <StatusLine icon={PackageOpen} color="#16a34a">
                {totalReady} crafteo{totalReady !== 1 ? 's' : ''} listo{totalReady !== 1 ? 's' : ''}
              </StatusLine>
            )}

            {totalCrafting === 0 && totalReady === 0 && potionCount === 0 && (
              <p className="text-[13px] text-text-3">Sin actividad</p>
            )}
          </>
        )}
        {!labUnlocked && !labDone && !labInProgress && (
          <p className="text-[13px] text-text-3">Sin construir</p>
        )}
      </>
    </ZoneCard>
  )
}

function BibliotecaCard({ byType, research, onGoTo }) {
  const now = new Date()
  const libLevel = byType['library']?.level ?? 0
  const libUnlocked = byType['library']?.unlocked !== false && libLevel > 0

  const libBuilding = byType['library']
  const libDone = libBuilding?.upgrade_ends_at && new Date(libBuilding.upgrade_ends_at) <= now
  const libInProgress = libBuilding?.upgrade_ends_at && new Date(libBuilding.upgrade_ends_at) > now

  const activeNode = research?.active
  const completedCount = (research?.completed ?? []).length
  const totalNodes = RESEARCH_NODES.length
  const activeNodeMeta = activeNode ? RESEARCH_NODES.find(n => n.id === activeNode.node_id) : null
  const researchReady = activeNode && new Date(activeNode.ends_at) <= now
  const progressPct = Math.round((completedCount / totalNodes) * 100)

  const alert = (researchReady || libDone) ? 'ready' : (activeNode && !researchReady) || libInProgress ? 'active' : null

  return (
    <ZoneCard id="biblioteca" color="#d97706" Icon={BookOpen} onGoTo={onGoTo} alert={alert}>
      {/* Header */}
      <>
        <div className="flex items-center gap-1.5">
          <p className="text-[16px] font-bold text-text leading-none">Biblioteca</p>
          {libUnlocked && (
            <span className="text-[11px] font-bold px-2 py-1 rounded-md leading-none"
              style={{ color: '#d97706', background: 'color-mix(in srgb,#d97706 12%,var(--surface))' }}>
              Nv.{libLevel}
            </span>
          )}
        </div>
      </>

      {/* Body */}
      <>
        {libDone && (
          <StatusLine icon={PackageOpen} color="#16a34a">Biblioteca lista</StatusLine>
        )}
        {libInProgress && !libDone && (
          <StatusLine icon={Wrench} color="#d97706">
            {libLevel === 0 ? 'Construyendo' : 'Mejorando'}… {fmtCountdown(libBuilding.upgrade_ends_at)}
          </StatusLine>
        )}
        {libUnlocked && !libDone && !libInProgress && (
          <>
            {/* Research progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] text-text-3">Investigación</span>
                <span className="text-[12px] font-semibold text-text-3">{completedCount}/{totalNodes}</span>
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${progressPct}%`, background: '#d97706' }} />
              </div>
            </div>

            {/* Active research */}
            {activeNode && (
              researchReady ? (
                <StatusLine icon={PackageOpen} color="#16a34a">
                  {activeNodeMeta?.name ?? 'Investigación'} lista
                </StatusLine>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Clock size={13} strokeWidth={2} className="flex-shrink-0 text-[#d97706]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-text truncate">{activeNodeMeta?.name ?? 'Investigando…'}</p>
                    <p className="text-[11px] font-semibold text-[#d97706] mt-0.5">{fmtCountdown(activeNode.ends_at)}</p>
                  </div>
                </div>
              )
            )}
            {!activeNode && (
              <p className="text-[13px] text-text-3">Sin investigación activa</p>
            )}
          </>
        )}
        {!libUnlocked && !libDone && !libInProgress && (
          <p className="text-[13px] text-text-3">Sin construir</p>
        )}
      </>
    </ZoneCard>
  )
}

/* ── Componente principal ────────────────────────────────────────────────────── */

export default function InicioZone({ byType, nexusData, trainingRooms, trainingProgress, potions, potionCraftingMap, runeCraftingMap, research, onGoTo }) {
  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RecursosCard byType={byType} nexusData={nexusData} onGoTo={onGoTo} />
        <EntrenamientoCard trainingRooms={trainingRooms} trainingProgress={trainingProgress} onGoTo={onGoTo} />
        <LaboratorioCard byType={byType} potions={potions} potionCraftingMap={potionCraftingMap} runeCraftingMap={runeCraftingMap} onGoTo={onGoTo} />
        <BibliotecaCard byType={byType} research={research} onGoTo={onGoTo} />
      </div>
    </motion.div>
  )
}
