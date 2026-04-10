import { CheckCircle2, Timer, Lock, Telescope, Coins, Pickaxe, Sparkles, Clock } from 'lucide-react'
import { BRANCH_META, BRANCH_ORDER } from './constants.js'
import { fmtCountdown, fmtHours } from './helpers.js'
import { RESEARCH_NODES } from '../../lib/gameConstants.js'

function CostRow({ cost, resources }) {
  const has = (key) => resources && resources[key] >= (cost[key] ?? 0)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {cost.gold > 0 && (
        <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${has('gold') ? 'text-[#16a34a]' : 'text-error-text'}`}>
          <Coins size={10} strokeWidth={2} />{cost.gold}
        </span>
      )}
      {cost.iron > 0 && (
        <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${has('iron') ? 'text-[#16a34a]' : 'text-error-text'}`}>
          <Pickaxe size={10} strokeWidth={2} />{cost.iron}
        </span>
      )}
      {cost.mana > 0 && (
        <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${has('mana') ? 'text-[#16a34a]' : 'text-error-text'}`}>
          <Sparkles size={10} strokeWidth={2} />{cost.mana}
        </span>
      )}
    </div>
  )
}

function ProgressBar({ pct, color }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, currentColor 10%, var(--surface-2))' }}>
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

function computePct(activeNode) {
  const now   = Date.now()
  const start = new Date(activeNode.started_at).getTime()
  const end   = new Date(activeNode.ends_at).getTime()
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}


function prereqName(node) {
  if (!node.prerequisite) return null
  const prereq = RESEARCH_NODES.find(n => n.id === node.prerequisite)
  return prereq?.name ?? node.prerequisite
}

function ResearchNodeCard({ node, state, activeNode, resources, libraryLevel, libraryUpgrading, hasActiveResearch, onStart, onCollect, startPending, collectPending }) {
  const bm        = BRANCH_META[node.branch]
  const libReq    = node.library_level_required ?? 1
  const isReady   = state === 'active' && Date.now() >= new Date(activeNode?.ends_at).getTime()
  const canAfford = resources
    ? resources.gold >= node.cost.gold && resources.iron >= node.cost.iron && resources.mana >= node.cost.mana
    : false

  // Un nodo disponible pero bloqueado por nivel de Biblioteca
  const lockedByLibrary = state === 'available' && libraryLevel < libReq

  const effectiveState = lockedByLibrary ? 'locked_library' : state

  const styles = {
    locked:         { border: 'border-border',                                                                opacity: 'opacity-50' },
    locked_library: { border: 'border-border',                                                                opacity: 'opacity-60' },
    available:      { border: 'border-border hover:border-[var(--blue-400,#60a5fa)]',                         opacity: '' },
    active:         { border: `border-[color-mix(in_srgb,${bm.color}_45%,var(--border))]`,                   opacity: '' },
    completed:      { border: `border-[color-mix(in_srgb,${bm.color}_25%,var(--border))]`,                   opacity: 'opacity-70' },
  }
  const s = styles[effectiveState] ?? styles.locked

  return (
    <div
      className={`relative flex flex-col gap-1.5 p-3 rounded-xl border bg-surface transition-all duration-150 ${s.border} ${s.opacity}`}
      style={{ '--accent': bm.color }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {effectiveState === 'completed' && (
            <CheckCircle2 size={13} strokeWidth={2.5} style={{ color: bm.color, flexShrink: 0 }} />
          )}
          {effectiveState === 'active' && (
            <Timer size={13} strokeWidth={2.5} style={{ color: bm.color, flexShrink: 0 }} />
          )}
          {(effectiveState === 'locked' || effectiveState === 'locked_library') && (
            <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
          )}
          {effectiveState === 'available' && (
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: bm.color, opacity: 0.65 }} />
          )}
          <span className={`text-[12px] font-semibold truncate ${effectiveState === 'locked' || effectiveState === 'locked_library' ? 'text-text-3' : 'text-text'}`}>
            {node.name}
          </span>
        </div>
        <div className="flex items-center gap-0.5 text-[10px] text-text-3 flex-shrink-0">
          <Clock size={9} strokeWidth={2} />
          <span>{node.duration_hours >= 24 ? `${node.duration_hours / 24}d` : `${node.duration_hours}h`}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[13px] text-text-3 leading-snug">{node.description}</p>

      {/* Lock por prerequisito */}
      {effectiveState === 'locked' && node.prerequisite && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-text-3 mt-0.5">
          <Lock size={10} strokeWidth={2.5} />
          Requiere: {prereqName(node)}
        </p>
      )}

      {/* Lock por nivel de Biblioteca */}
      {effectiveState === 'locked_library' && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-text-3 mt-0.5">
          <Lock size={10} strokeWidth={2.5} />
          Requiere Biblioteca Nv.{libReq}
        </p>
      )}

      {/* Available: costes + botón */}
      {effectiveState === 'available' && (
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <CostRow cost={node.cost} resources={resources} />
          <button
            className="btn btn--primary btn--sm flex-shrink-0"
            style={{ fontSize: '11px', padding: '2px 10px', height: '24px', minHeight: 'unset' }}
            onClick={() => onStart(node.id)}
            disabled={startPending || !canAfford || hasActiveResearch || libraryUpgrading}
            title={libraryUpgrading ? 'Biblioteca en mejora' : hasActiveResearch ? 'Ya hay una investigación en curso' : !canAfford ? 'Recursos insuficientes' : undefined}
          >
            Investigar
          </button>
        </div>
      )}

      {/* Active: barra de progreso + info completa */}
      {effectiveState === 'active' && !isReady && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <ProgressBar pct={computePct(activeNode)} color={bm.color} />
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono text-text-2">{fmtCountdown(activeNode.ends_at)} restante</span>
            <span className="text-[10px] text-text-3">{fmtHours(node.duration_hours)} total</span>
          </div>
        </div>
      )}

      {effectiveState === 'active' && isReady && (
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex flex-col gap-0.5">
            <ProgressBar pct={100} color={bm.color} />
            <span className="text-[11px] font-bold" style={{ color: bm.color }}>¡Completado!</span>
          </div>
          <button
            className="btn btn--primary btn--sm flex-shrink-0"
            style={{ fontSize: '11px', padding: '2px 10px', height: '24px', minHeight: 'unset' }}
            onClick={() => onCollect(node.id)}
            disabled={collectPending}
          >
            Recoger
          </button>
        </div>
      )}
    </div>
  )
}

function ResearchBranch({ branch, nodesInBranch, completedSet, activeNode, resources, libraryLevel, libraryUpgrading, hasActiveResearch, onStart, onCollect, startPending, collectPending }) {
  const bm = BRANCH_META[branch]
  const BranchIcon = bm.icon

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb,${bm.color} 12%,var(--surface-2))` }}
        >
          <BranchIcon size={12} strokeWidth={2} style={{ color: bm.color }} />
        </div>
        <span className="text-[12px] font-bold text-text">{bm.label}</span>
      </div>

      <div className="flex flex-col gap-2">
        {nodesInBranch.map((node, idx) => {
          const prereqDone  = !node.prerequisite || completedSet.has(node.prerequisite)
          const isCompleted = completedSet.has(node.id)
          const isActive    = activeNode?.node_id === node.id

          let state = 'locked'
          if (isCompleted)       state = 'completed'
          else if (isActive)     state = 'active'
          else if (prereqDone)   state = 'available'

          return (
            <div key={node.id} className="relative">
              {idx > 0 && (
                <div
                  className="absolute left-[18px] -top-2 w-px h-2"
                  style={{
                    background: nodesInBranch[idx - 1] && completedSet.has(nodesInBranch[idx - 1].id)
                      ? bm.color : 'var(--border)',
                    opacity: 0.6,
                  }}
                />
              )}
              <ResearchNodeCard
                node={node}
                state={state}
                activeNode={activeNode}
                resources={resources}
                libraryLevel={libraryLevel}
                libraryUpgrading={libraryUpgrading}
                hasActiveResearch={hasActiveResearch}
                onStart={onStart}
                onCollect={onCollect}
                startPending={startPending}
                collectPending={collectPending}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ResearchTree({ research, resources, libraryLevel, libraryUpgrading, onStart, onCollect, startPending, collectPending }) {
  const completedSet    = new Set(research.completed ?? [])
  const activeNode      = research.active
  const hasActiveResearch = !!activeNode && new Date(activeNode.ends_at) > new Date()
  const byBranch        = Object.fromEntries(BRANCH_ORDER.map(b => [b, RESEARCH_NODES.filter(n => n.branch === b)]))

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 mb-4">
        <Telescope size={14} strokeWidth={2} className="text-[#0f766e]" />
        <span className="text-[14px] font-bold text-text">Árbol de Investigación</span>
        {hasActiveResearch && (
          <span className="ml-auto text-[11px] text-text-3">1 ranura activa</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BRANCH_ORDER.map(branch => (
          <ResearchBranch
            key={branch}
            branch={branch}
            nodesInBranch={byBranch[branch]}
            completedSet={completedSet}
            activeNode={activeNode}
            resources={resources}
            libraryLevel={libraryLevel}
            libraryUpgrading={libraryUpgrading}
            hasActiveResearch={hasActiveResearch}
            onStart={onStart}
            onCollect={onCollect}
            startPending={startPending}
            collectPending={collectPending}
          />
        ))}
      </div>
    </div>
  )
}
