import { CheckCircle2, Timer, Lock, Telescope } from 'lucide-react'
import { BRANCH_META, BRANCH_ORDER } from './constants.js'
import { fmtCountdown } from './helpers.js'
import { RESEARCH_NODES } from '../../lib/gameConstants.js'

function ResearchNodeCard({ node, state, isActive, activeNode, resources, onStart, onCollect, startPending, collectPending }) {
  const bm = BRANCH_META[node.branch]
  const isReady = isActive && new Date(activeNode?.ends_at) <= new Date()

  const stateColors = {
    locked:    { bg: 'bg-surface',   border: 'border-border',                           text: 'text-text-3'  },
    available: { bg: 'bg-surface',   border: 'border-border hover:border-[var(--blue-400)]', text: 'text-text' },
    active:    { bg: 'bg-surface-2', border: 'border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]', text: 'text-text' },
    completed: { bg: 'bg-surface',   border: 'border-[color-mix(in_srgb,var(--accent)_30%,var(--border))]', text: 'text-text' },
  }

  const sc = stateColors[state] ?? stateColors.locked

  const canAfford = resources
    ? resources.gold >= node.cost.gold && resources.iron >= node.cost.iron && resources.mana >= node.cost.mana
    : false

  return (
    <div
      className={`relative flex flex-col gap-1.5 p-3 rounded-xl border transition-all duration-150 ${sc.bg} ${sc.border}`}
      style={{ '--accent': bm.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {state === 'completed' && (
            <CheckCircle2 size={13} strokeWidth={2.5} style={{ color: bm.color, flexShrink: 0 }} />
          )}
          {state === 'active' && (
            <Timer size={13} strokeWidth={2.5} style={{ color: bm.color, flexShrink: 0 }} />
          )}
          {state === 'locked' && (
            <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
          )}
          {state === 'available' && (
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: bm.color, opacity: 0.6 }} />
          )}
          <span className={`text-[12px] font-semibold truncate ${sc.text}`}>{node.name}</span>
        </div>
        <span className="text-[10px] text-text-3 flex-shrink-0 font-mono">
          {node.duration_hours >= 24
            ? `${node.duration_hours / 24}d`
            : `${node.duration_hours}h`}
        </span>
      </div>

      <p className="text-[11px] text-text-3 leading-snug">{node.description}</p>

      {state === 'available' && (
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-2 text-[10px] text-text-3 flex-wrap">
            {node.cost.gold  > 0 && <span className="text-[#d97706]">{node.cost.gold}g</span>}
            {node.cost.iron  > 0 && <span className="text-[#64748b]">{node.cost.iron}h</span>}
            {node.cost.mana  > 0 && <span className="text-[#7c3aed]">{node.cost.mana}m</span>}
          </div>
          <button
            className="btn btn--primary btn--sm flex-shrink-0"
            style={{ fontSize: '11px', padding: '2px 10px', height: '24px', minHeight: 'unset' }}
            onClick={() => onStart(node.id)}
            disabled={startPending || !canAfford}
            title={!canAfford ? 'Recursos insuficientes' : undefined}
          >
            Investigar
          </button>
        </div>
      )}

      {state === 'active' && (
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {isReady ? (
            <span className="text-[11px] font-bold" style={{ color: bm.color }}>¡Listo para recoger!</span>
          ) : (
            <span className="text-[11px] text-text-3 font-mono">{fmtCountdown(activeNode.ends_at)}</span>
          )}
          {isReady && (
            <button
              className="btn btn--primary btn--sm flex-shrink-0"
              style={{ fontSize: '11px', padding: '2px 10px', height: '24px', minHeight: 'unset' }}
              onClick={() => onCollect(node.id)}
              disabled={collectPending}
            >
              Recoger
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function ResearchBranch({ branch, nodesInBranch, completedSet, activeNode, resources, onStart, onCollect, startPending, collectPending }) {
  const bm = BRANCH_META[branch]
  const BranchIcon = bm.icon

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb,${bm.color} 12%,var(--surface-2))` }}>
          <BranchIcon size={12} strokeWidth={2} style={{ color: bm.color }} />
        </div>
        <span className="text-[12px] font-bold text-text">{bm.label}</span>
      </div>

      <div className="flex flex-col gap-2">
        {nodesInBranch.map((node, idx) => {
          const prereqDone = !node.prerequisite || completedSet.has(node.prerequisite)
          const isCompleted = completedSet.has(node.id)
          const isActive    = activeNode?.node_id === node.id
          let state = 'locked'
          if (isCompleted) state = 'completed'
          else if (isActive) state = 'active'
          else if (prereqDone) state = 'available'

          return (
            <div key={node.id} className="relative">
              {idx > 0 && (
                <div
                  className="absolute left-[18px] -top-2 w-px h-2"
                  style={{
                    background: nodesInBranch[idx - 1] && completedSet.has(nodesInBranch[idx - 1].id)
                      ? bm.color
                      : 'var(--border)',
                    opacity: 0.6,
                  }}
                />
              )}
              <ResearchNodeCard
                node={node}
                state={state}
                isActive={isActive}
                activeNode={activeNode}
                resources={resources}
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

export function ResearchTree({ research, resources, onStart, onCollect, startPending, collectPending }) {
  const completedSet = new Set(research.completed ?? [])
  const activeNode   = research.active
  const byBranch     = Object.fromEntries(BRANCH_ORDER.map(b => [b, RESEARCH_NODES.filter(n => n.branch === b)]))

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 mb-4">
        <Telescope size={14} strokeWidth={2} className="text-[#0f766e]" />
        <span className="text-[14px] font-bold text-text">Árbol de Investigación</span>
        {activeNode && (
          <span className="ml-auto text-[11px] text-text-3 font-medium">
            1 investigación activa
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {BRANCH_ORDER.map(branch => (
          <ResearchBranch
            key={branch}
            branch={branch}
            nodesInBranch={byBranch[branch]}
            completedSet={completedSet}
            activeNode={activeNode}
            resources={resources}
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
