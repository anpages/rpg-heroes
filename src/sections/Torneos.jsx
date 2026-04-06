import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Shield, Swords, Trophy, Skull, Star, Coins, Sparkles, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useTournament } from '../hooks/useTournament'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { CombatReplay } from '../components/CombatReplay'

const ROUND_LABELS = ['Cuartos', 'Semifinal', 'Final']
const ROUND_COLORS = ['#2563eb', '#d97706', '#dc2626']

function StatChip({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5">
      <span className="text-[11px] text-text-3 uppercase tracking-wide font-bold">{label}</span>
      <span className="text-[14px] font-extrabold text-text tabular-nums">{value}</span>
    </div>
  )
}

function RivalCard({ rival, round, isNext }) {
  const color = ROUND_COLORS[round - 1]
  return (
    <div className={`bg-surface border rounded-xl p-4 flex flex-col gap-3 ${isNext ? 'border-[var(--rival-color)] shadow-[0_0_0_1px_var(--rival-color)]' : 'border-border opacity-60'}`}
      style={{ '--rival-color': color }}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color }}>{rival.roundLabel}</span>
          <p className="text-[16px] font-extrabold text-text mt-0.5">{rival.name}</p>
          <p className="text-[12px] text-text-3">{rival.class} · {rival.spec}</p>
        </div>
        {isNext && <Swords size={22} color={color} strokeWidth={1.8} />}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        <StatChip label="HP"  value={rival.stats.max_hp} />
        <StatChip label="Atq" value={rival.stats.attack} />
        <StatChip label="Def" value={rival.stats.defense} />
        <StatChip label="Fue" value={rival.stats.strength} />
        <StatChip label="Agi" value={rival.stats.agility} />
      </div>
    </div>
  )
}

function RoundBadge({ round, won, isCurrent }) {
  const label = ROUND_LABELS[round - 1]
  const color = ROUND_COLORS[round - 1]
  if (won === true)  return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#16a34a_12%,var(--surface-2))] border border-[color-mix(in_srgb,#16a34a_30%,var(--border))] text-[#15803d]">✓ {label}</span>
  if (won === false) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#dc2626_10%,var(--surface-2))] border border-[color-mix(in_srgb,#dc2626_25%,var(--border))] text-[#dc2626]">✗ {label}</span>
  if (isCurrent)     return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border text-[var(--c)]" style={{ '--c': color, background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, borderColor: `color-mix(in srgb,${color} 30%,var(--border))` }}>● {label}</span>
  return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-3">○ {label}</span>
}

export default function Torneos() {
  const heroId      = useHeroId()
  const { data: hero } = useHero(heroId)
  const { data, isLoading } = useTournament(heroId)
  const queryClient = useQueryClient()
  const [replay, setReplay]   = useState(null)
  const [replayWon, setReplayWon]     = useState(false)
  const [replayRewards, setReplayRewards] = useState(null)
  const [replayKO, setReplayKO]       = useState(false)

  const nowMs  = Date.now()
  const hpNow  = hero ? interpolateHp(hero, nowMs) : 0
  const minHp  = hero ? Math.floor(hero.max_hp * 0.2) : 0
  const hasHp  = hpNow >= minHp

  const registerMutation = useMutation({
    mutationFn: () => apiPost('/api/tournament-register', { heroId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(heroId) })
      toast.success('¡Inscrito en el torneo!')
    },
    onError: (err) => toast.error(err.message),
  })

  const fightMutation = useMutation({
    mutationFn: () => apiPost('/api/tournament-fight', { heroId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      setReplayWon(data.won)
      setReplayRewards(data.rewards)
      setReplayKO(data.knockedOut)
      setReplay({ log: data.log, heroMaxHp: data.heroMaxHp, rivalMaxHp: data.rivalMaxHp, rival: data.rival })
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <p className="text-text-3 text-[14px] text-center py-10">Cargando torneo...</p>

  const { bracket, matches } = data ?? { bracket: null, matches: [] }

  const matchByRound = {}
  for (const m of matches) matchByRound[m.round] = m

  // Estado: sin inscribir
  if (!bracket) return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-4 text-center shadow-[var(--shadow-sm)]">
        <span className="text-[48px] leading-none">🏆</span>
        <div>
          <p className="text-[20px] font-extrabold text-text">Torneo Semanal</p>
          <p className="text-[13px] text-text-3 mt-1 max-w-xs mx-auto">3 rondas de combate PvE. Llega a la final y gana una carta de habilidad garantizada.</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {ROUND_LABELS.map((l, i) => (
            <span key={l} className="text-[11px] font-bold px-2.5 py-1 rounded-full border" style={{ color: ROUND_COLORS[i], background: `color-mix(in srgb,${ROUND_COLORS[i]} 10%,var(--surface-2))`, borderColor: `color-mix(in srgb,${ROUND_COLORS[i]} 25%,var(--border))` }}>
              {l}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] text-text-3 w-full max-w-xs text-left">
          <p className="flex items-center gap-2"><Coins size={13} color="#d97706" /> Ganar cuartos: 100 oro + 50 XP</p>
          <p className="flex items-center gap-2"><Sparkles size={13} color="#7c3aed" /> Ganar semifinal: 200 oro + 20 maná</p>
          <p className="flex items-center gap-2"><Trophy size={13} color="#d97706" /> Campeón: 500 oro + carta garantizada</p>
        </div>
        <motion.button
          className="btn btn--primary btn--lg min-w-[180px]"
          onClick={() => registerMutation.mutate()}
          disabled={registerMutation.isPending || hero?.status !== 'idle'}
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Shield size={16} strokeWidth={2} />
          {registerMutation.isPending ? 'Inscribiendo...' : 'Inscribirse'}
        </motion.button>
      </div>
    </div>
  )

  const nextRound  = bracket.current_round + 1
  const nextRival  = !bracket.eliminated && !bracket.champion && nextRound <= 3
    ? bracket.rivals[nextRound - 1]
    : null

  return (
    <div className="flex flex-col gap-4">

      {/* Estado del torneo */}
      <div className="bg-surface border border-border rounded-xl px-5 py-4 flex flex-col gap-3 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold text-text">Torneo semanal</p>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {[1, 2, 3].map(r => (
              <RoundBadge
                key={r}
                round={r}
                won={matchByRound[r]?.won}
                isCurrent={r === nextRound && !bracket.eliminated && !bracket.champion}
              />
            ))}
          </div>
        </div>

        {bracket.champion && (
          <div className="flex items-center gap-3 py-2">
            <span className="text-[36px] leading-none">🏆</span>
            <div>
              <p className="text-[17px] font-extrabold text-[#d97706]">¡Campeón!</p>
              <p className="text-[12px] text-text-3">Has ganado el torneo de esta semana</p>
            </div>
          </div>
        )}

        {bracket.eliminated && !bracket.champion && (
          <div className="flex items-center gap-3 py-2">
            <Skull size={28} color="#dc2626" strokeWidth={1.6} />
            <div>
              <p className="text-[15px] font-bold text-[#dc2626]">Eliminado</p>
              <p className="text-[12px] text-text-3">El próximo torneo empieza el lunes</p>
            </div>
          </div>
        )}
      </div>

      {/* Rival actual */}
      {nextRival && (
        <div className="flex flex-col gap-3">
          <RivalCard rival={nextRival} round={nextRound} isNext />

          {!hasHp && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,#dc2626_10%,var(--surface))] border border-[color-mix(in_srgb,#dc2626_30%,var(--border))]">
              <span className="text-[15px]">⚠️</span>
              <p className="text-[12px] font-semibold text-[#dc2626]">
                HP insuficiente. Necesitas {minHp} HP para combatir ({hpNow} actuales).
              </p>
            </div>
          )}

          <motion.button
            className="btn btn--primary btn--lg btn--full"
            onClick={() => fightMutation.mutate()}
            disabled={fightMutation.isPending || !hasHp || hero?.status !== 'idle'}
            whileTap={fightMutation.isPending || !hasHp ? {} : { scale: 0.97 }}
            whileHover={fightMutation.isPending || !hasHp ? {} : { scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Swords size={16} strokeWidth={2} />
            {fightMutation.isPending ? 'Combatiendo...' : `Combatir en ${ROUND_LABELS[nextRound - 1]}`}
          </motion.button>
        </div>
      )}

      {/* Rivales de rondas pasadas */}
      {bracket.rivals.filter((_, i) => i + 1 < nextRound || bracket.eliminated || bracket.champion).map((rival, i) => {
        const round = i + 1
        const match = matchByRound[round]
        if (!match) return null
        return (
          <div key={round} className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl">
            <span className="text-[20px] leading-none">{match.won ? '🏆' : '💀'}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-bold ${match.won ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
                {match.won ? 'Victoria' : 'Derrota'} · {ROUND_LABELS[round - 1]}
              </p>
              <p className="text-[11px] text-text-3">{rival.name} ({rival.class})</p>
            </div>
            {match.log?.length > 0 && (
              <button
                className="btn btn--ghost btn--sm flex-shrink-0"
                onClick={() => {
                  setReplayWon(match.won)
                  setReplayRewards(match.rewards)
                  setReplayKO(false)
                  setReplay({ log: match.log, heroMaxHp: match.hero_max_hp, rivalMaxHp: match.rival_max_hp, rival })
                }}
              >
                Ver
              </button>
            )}
          </div>
        )
      })}

      {/* Rivales pendientes (eliminado antes de llegar) */}
      {bracket.eliminated && bracket.rivals.filter((_, i) => i + 1 > bracket.current_round + 1).map((rival, i) => (
        <RivalCard key={rival.round} rival={rival} round={rival.round} isNext={false} />
      ))}

      {replay && (
        <CombatReplay
          heroName={hero?.name ?? 'Héroe'}
          enemyName={replay.rival?.name ?? 'Rival'}
          heroMaxHp={replay.heroMaxHp}
          enemyMaxHp={replay.rivalMaxHp}
          log={replay.log}
          won={replayWon}
          rewards={replayRewards}
          knockedOut={replayKO}
          onClose={() => setReplay(null)}
        />
      )}
    </div>
  )
}
