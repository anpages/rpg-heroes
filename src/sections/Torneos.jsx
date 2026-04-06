import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Shield, Swords, Trophy, Skull, Star, Coins, Sparkles, Zap, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useTournament } from '../hooks/useTournament'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { CombatReplay } from '../components/CombatReplay'

const ROUND_LABELS  = ['Cuartos', 'Semifinal', 'Final']
const ROUND_COLORS  = ['#2563eb', '#d97706', '#dc2626']
const ROUND_WINDOWS = ['Lun – Mar', 'Mié – Jue', 'Vie – Sáb']

/* ── Helpers de calendario ─────────────────────────────────────────────────── */

function getRoundWindows(weekStart) {
  const base = new Date(weekStart + 'T00:00:00Z').getTime()
  const day  = (n) => new Date(base + n * 86_400_000)
  return {
    1: { opens: day(0), closes: day(2) },
    2: { opens: day(2), closes: day(4) },
    3: { opens: day(4), closes: day(6) },
  }
}

function getAvailableRound(weekStart) {
  if (!weekStart) return null
  const windows = getRoundWindows(weekStart)
  const now = Date.now()
  for (const [r, w] of Object.entries(windows)) {
    if (now >= w.opens.getTime() && now < w.closes.getTime()) return Number(r)
  }
  return null
}

function fmtDate(d) {
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/* ── Sub-componentes ───────────────────────────────────────────────────────── */

function StatChip({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-surface-2 border border-border rounded-lg px-2 py-1.5">
      <span className="text-[10px] text-text-3 uppercase tracking-wide font-bold">{label}</span>
      <span className="text-[13px] font-extrabold text-text tabular-nums">{value}</span>
    </div>
  )
}

function RivalCard({ rival, round, state }) {
  // state: 'next' | 'won' | 'lost' | 'locked'
  const color = ROUND_COLORS[round - 1]
  const opacity = state === 'locked' ? 'opacity-50' : ''

  return (
    <div
      className={`bg-surface border rounded-xl p-4 flex flex-col gap-3 ${opacity} ${
        state === 'next'
          ? 'border-[var(--c)] shadow-[0_0_0_1px_var(--c)]'
          : 'border-border'
      }`}
      style={{ '--c': color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color }}>
            {rival.roundLabel} · {ROUND_WINDOWS[round - 1]}
          </span>
          <p className="text-[16px] font-extrabold text-text mt-0.5">{rival.name}</p>
          <p className="text-[12px] text-text-3">{rival.class} · {rival.spec}</p>
        </div>
        {state === 'next'  && <Swords size={20} color={color} strokeWidth={1.8} className="flex-shrink-0 mt-1" />}
        {state === 'won'   && <span className="text-[20px]">🏆</span>}
        {state === 'lost'  && <span className="text-[20px]">💀</span>}
        {state === 'locked'&& <span className="text-[20px]">🔒</span>}
      </div>
      <div className="grid grid-cols-5 gap-1">
        <StatChip label="HP"  value={rival.stats.max_hp} />
        <StatChip label="Atq" value={rival.stats.attack} />
        <StatChip label="Def" value={rival.stats.defense} />
        <StatChip label="Fue" value={rival.stats.strength} />
        <StatChip label="Agi" value={rival.stats.agility} />
      </div>
    </div>
  )
}

function RoundPip({ round, won, isCurrent, isPast }) {
  const color = ROUND_COLORS[round - 1]
  const label = ROUND_LABELS[round - 1]
  if (won === true)  return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#16a34a_12%,var(--surface-2))] border border-[color-mix(in_srgb,#16a34a_30%,var(--border))] text-[#15803d]">✓ {label}</span>
  if (won === false) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#dc2626_10%,var(--surface-2))] border border-[color-mix(in_srgb,#dc2626_25%,var(--border))] text-[#dc2626]">✗ {label}</span>
  if (isCurrent)     return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border" style={{ color, background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, borderColor: `color-mix(in srgb,${color} 30%,var(--border))` }}>● {label}</span>
  return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-3">○ {label}</span>
}

/* ── Main ──────────────────────────────────────────────────────────────────── */

export default function Torneos() {
  const heroId = useHeroId()
  const { data: hero } = useHero(heroId)
  const { data, isLoading } = useTournament(heroId)
  const queryClient = useQueryClient()
  const [replay, setReplay] = useState(null)

  const weekStart      = data?.weekStart ?? null
  const availableRound = useMemo(() => getAvailableRound(weekStart), [weekStart])
  const windows        = useMemo(() => weekStart ? getRoundWindows(weekStart) : null, [weekStart])

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
      setReplay({
        log: data.log, heroMaxHp: data.heroMaxHp, rivalMaxHp: data.rivalMaxHp,
        rival: data.rival, won: data.won, rewards: data.rewards,
      })
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) return <p className="text-text-3 text-[14px] text-center py-10">Cargando torneo...</p>

  const { bracket, matches = [] } = data ?? {}
  const matchByRound = Object.fromEntries(matches.map(m => [m.round, m]))

  // ── Sin inscripción ────────────────────────────────────────────────────────
  if (!bracket) {
    const w = windows
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-4 text-center shadow-[var(--shadow-sm)]">
          <span className="text-[48px] leading-none">🏆</span>
          <div>
            <p className="text-[20px] font-extrabold text-text">Torneo Semanal</p>
            <p className="text-[13px] text-text-3 mt-1 max-w-xs mx-auto">
              3 rondas de combate PvE. Una ronda cada dos días — si no combates en tu ventana, quedas eliminado.
            </p>
          </div>

          {w && (
            <div className="flex flex-col gap-1.5 w-full max-w-xs text-left">
              {[1, 2, 3].map(r => (
                <div key={r} className="flex items-center gap-2 text-[12px]">
                  <span className="font-bold" style={{ color: ROUND_COLORS[r - 1] }}>{ROUND_LABELS[r - 1]}</span>
                  <span className="text-text-3 flex items-center gap-1">
                    <Clock size={11} /> {fmtDate(w[r].opens)} → {fmtDate(w[r].closes)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 text-[13px] text-text-3 w-full max-w-xs text-left">
            <p className="flex items-center gap-2"><Coins size={13} color="#d97706" /> Cuartos: 100 oro + 50 XP</p>
            <p className="flex items-center gap-2"><Sparkles size={13} color="#7c3aed" /> Semifinal: 200 oro + 20 maná</p>
            <p className="flex items-center gap-2"><Trophy size={13} color="#d97706" /> Final: 500 oro + carta garantizada</p>
          </div>

          <motion.button
            className="btn btn--primary btn--lg min-w-[180px]"
            onClick={() => registerMutation.mutate()}
            disabled={registerMutation.isPending || !heroId}
            whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Shield size={16} strokeWidth={2} />
            {registerMutation.isPending ? 'Inscribiendo...' : 'Inscribirse'}
          </motion.button>
        </div>
      </div>
    )
  }

  // ── Con inscripción ────────────────────────────────────────────────────────
  const nextRound  = bracket.current_round + 1
  const canFight   = !bracket.eliminated && !bracket.champion && availableRound === nextRound

  return (
    <div className="flex flex-col gap-4">

      {/* Estado general */}
      <div className="bg-surface border border-border rounded-xl px-5 py-4 flex flex-col gap-3 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[13px] font-bold text-text">Torneo semanal</p>
          <div className="flex gap-1.5 flex-wrap">
            {[1, 2, 3].map(r => (
              <RoundPip
                key={r} round={r}
                won={matchByRound[r]?.won}
                isCurrent={r === nextRound && !bracket.eliminated && !bracket.champion}
              />
            ))}
          </div>
        </div>

        {bracket.champion && (
          <div className="flex items-center gap-3">
            <span className="text-[36px]">🏆</span>
            <div>
              <p className="text-[17px] font-extrabold text-[#d97706]">¡Campeón de la semana!</p>
              <p className="text-[12px] text-text-3">Has conquistado el torneo</p>
            </div>
          </div>
        )}

        {bracket.eliminated && !bracket.champion && (
          <div className="flex items-center gap-3">
            <Skull size={24} color="#dc2626" strokeWidth={1.6} />
            <div>
              <p className="text-[14px] font-bold text-[#dc2626]">Eliminado</p>
              <p className="text-[12px] text-text-3">El próximo torneo empieza el lunes</p>
            </div>
          </div>
        )}

        {/* Próxima ventana disponible */}
        {!bracket.eliminated && !bracket.champion && windows && availableRound !== nextRound && (
          <div className="flex items-center gap-2 text-[12px] text-text-3">
            <Clock size={12} />
            {availableRound === null
              ? `Ronda ${nextRound} disponible: ${fmtDate(windows[nextRound].opens)} – ${fmtDate(windows[nextRound].closes)}`
              : 'Completa la ronda disponible primero'}
          </div>
        )}
      </div>

      {/* Rivales */}
      <div className="flex flex-col gap-2.5">
        {bracket.rivals.map((rival, i) => {
          const r     = i + 1
          const match = matchByRound[r]
          let state   = 'locked'
          if (match?.won === true)  state = 'won'
          else if (match?.won === false) state = 'lost'
          else if (r === nextRound && !bracket.eliminated) state = 'next'

          return (
            <div key={r} className="flex flex-col gap-2">
              <RivalCard rival={rival} round={r} state={state} />

              {match && (
                <div className="flex items-center justify-between px-2">
                  <span className={`text-[12px] font-semibold ${match.won ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
                    {match.won ? '¡Victoria!' : 'Derrota'}
                  </span>
                  {match.log?.length > 0 && (
                    <button className="btn btn--ghost btn--sm" onClick={() => setReplay({ ...match, rival })}>
                      Ver replay
                    </button>
                  )}
                </div>
              )}

              {state === 'next' && canFight && (
                <motion.button
                  className="btn btn--primary btn--full"
                  onClick={() => fightMutation.mutate()}
                  disabled={fightMutation.isPending || hero?.status === 'exploring'}
                  whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Swords size={15} strokeWidth={2} />
                  {fightMutation.isPending ? 'Combatiendo...' : `Combatir en ${ROUND_LABELS[r - 1]}`}
                </motion.button>
              )}

              {state === 'next' && !canFight && !bracket.eliminated && availableRound !== nextRound && windows && (
                <p className="text-[11px] text-text-3 text-center px-2">
                  Disponible {fmtDate(windows[r].opens)} – {fmtDate(windows[r].closes)}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {replay && (
        <CombatReplay
          heroName={hero?.name ?? 'Héroe'}
          enemyName={replay.rival?.name ?? 'Rival'}
          heroMaxHp={replay.hero_max_hp ?? replay.heroMaxHp}
          enemyMaxHp={replay.rival_max_hp ?? replay.rivalMaxHp}
          log={replay.log}
          won={replay.won}
          rewards={replay.rewards}
          knockedOut={false}
          onClose={() => setReplay(null)}
        />
      )}
    </div>
  )
}
