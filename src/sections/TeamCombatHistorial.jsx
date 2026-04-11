import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useTeamCombats } from '../hooks/useTeamCombats'
import { TeamCombatReplay } from '../components/TeamCombatReplay'
import { computeSynergy } from '../lib/teamSynergy'
import { Users, Coins, Star } from 'lucide-react'

const CLASS_COLOR = {
  caudillo:  '#dc2626',
  arcanista: '#7c3aed',
  sombra:    '#0369a1',
  domador:   '#16a34a',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'Ahora'
  if (m < 60) return `Hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `Hace ${h}h`
  return `Hace ${Math.floor(h / 24)}d`
}

function ClassChips({ classes }) {
  return (
    <div className="flex items-center gap-1">
      {classes.map((c, i) => (
        <span
          key={i}
          className="w-5 h-5 rounded-md text-[9px] font-extrabold flex items-center justify-center uppercase"
          style={{
            color: CLASS_COLOR[c] ?? '#6b7280',
            background: `color-mix(in srgb, ${CLASS_COLOR[c] ?? '#6b7280'} 14%, var(--surface-2))`,
            border: `1px solid color-mix(in srgb, ${CLASS_COLOR[c] ?? '#6b7280'} 30%, var(--border))`,
          }}
          title={c}
        >
          {c[0]}
        </span>
      ))}
    </div>
  )
}

function buildReplayPayload(row) {
  const teamA = row.hero_names.map((name, i) => ({
    name,
    class:  row.hero_classes[i],
    max_hp: row.hero_max_hps[i],
  }))
  const teamB = row.enemy_names.map((name, i) => ({
    name,
    class:  row.enemy_classes[i],
    max_hp: row.enemy_max_hps[i],
  }))
  const synergy = computeSynergy(row.hero_classes)
  const rewards = row.won
    ? { gold: row.gold_reward, xpPerHero: row.xp_reward }
    : null
  return { teamA, teamB, log: row.log, won: row.won, synergy, rewards }
}

export default function TeamCombatHistorial() {
  const userId = useAppStore(s => s.userId)
  const { combats, loading } = useTeamCombats(userId)
  const [replay, setReplay] = useState(null)

  if (loading) {
    return <p className="text-text-3 text-[14px] text-center py-10">Cargando historial...</p>
  }

  if (!combats.length) {
    return (
      <div className="text-center py-12">
        <p className="text-[32px] mb-3">⚔️</p>
        <p className="text-text-2 font-semibold">Sin combates de escuadrón</p>
        <p className="text-text-3 text-[13px] mt-1">Tus combates 3v3 aparecerán aquí</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {combats.map(c => {
          const resultColor = c.won ? '#15803d' : '#dc2626'
          const synergy     = computeSynergy(c.hero_classes)

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setReplay(buildReplayPayload(c))}
              className="bg-surface border border-border rounded-xl overflow-hidden flex text-left hover:bg-surface-2 transition-[background] duration-150 cursor-pointer p-0"
            >
              <div className="w-1.5 flex-shrink-0" style={{ background: resultColor }} />

              <div className="flex-1 px-4 py-3 flex items-center gap-3 min-w-0">
                <span className="text-[24px] leading-none flex-shrink-0">
                  {c.won ? '🏆' : '💀'}
                </span>

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-extrabold ${c.won ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
                      {c.won ? 'Victoria' : 'Derrota'}
                    </span>
                    <span className="text-text-3 text-[10px]">·</span>
                    <span className="text-[11px] text-text-3">{c.rounds} rondas</span>
                    <span className="text-text-3 text-[10px]">·</span>
                    <span className="text-[11px] text-text-3">{timeAgo(c.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <ClassChips classes={c.hero_classes} />
                    <span className="text-[10px] font-bold text-text-3">VS</span>
                    <ClassChips classes={c.enemy_classes} />
                  </div>
                  {synergy && synergy.attackPct !== 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold" style={{
                      color: synergy.attackPct > 0 ? '#16a34a' : '#dc2626',
                    }}>
                      <Users size={9} strokeWidth={2.5} />
                      {synergy.label}
                    </span>
                  )}
                </div>

                {c.won && (
                  <div className="flex flex-col gap-0.5 items-end flex-shrink-0">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#15803d]">
                      <Coins size={10} color="#d97706" strokeWidth={2} />+{c.gold_reward}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#15803d]">
                      <Star size={10} color="#0369a1" strokeWidth={2} />+{c.xp_reward}
                    </span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {replay && (
        <TeamCombatReplay
          teamA={replay.teamA}
          teamB={replay.teamB}
          log={replay.log}
          won={replay.won}
          rewards={replay.rewards}
          synergy={replay.synergy}
          onClose={() => setReplay(null)}
        />
      )}
    </>
  )
}
