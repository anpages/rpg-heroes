import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trophy, Swords, Shield, Skull, Coins, Sparkles, Clock, Flame, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useTournament } from '../hooks/useTournament'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { CombatReplay } from '../components/CombatReplay'

const ROUND_LABELS = ['Cuartos', 'Semifinal', 'Final']
const ROUND_COLORS = ['#2563eb', '#d97706', '#dc2626']

const WEEK_DAYS = [
  { offset: 0, short: 'L', label: 'Lun',  type: 'grace' },
  { offset: 1, short: 'M', label: 'Mar',  type: 'fight', round: 1 },
  { offset: 2, short: 'X', label: 'Mié',  type: 'rest'  },
  { offset: 3, short: 'J', label: 'Jue',  type: 'fight', round: 2 },
  { offset: 4, short: 'V', label: 'Vie',  type: 'rest'  },
  { offset: 5, short: 'S', label: 'Sáb',  type: 'fight', round: 3 },
  { offset: 6, short: 'D', label: 'Dom',  type: 'grace' },
]

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function getRoundWindows(weekStart) {
  const base = new Date(weekStart + 'T00:00:00Z').getTime()
  const day  = n => new Date(base + n * 86_400_000)
  return {
    1: { opens: day(1), closes: day(2) },
    2: { opens: day(3), closes: day(4) },
    3: { opens: day(5), closes: day(6) },
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

function getTodayOffset(weekStart) {
  if (!weekStart) return null
  const base   = new Date(weekStart + 'T00:00:00Z').getTime()
  const offset = Math.floor((Date.now() - base) / 86_400_000)
  return offset >= 0 && offset <= 6 ? offset : null
}

function fmtDate(d) {
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/* ── BracketPath ────────────────────────────────────────────────────────────── */

function BracketPath({ matchByRound, nextRound, eliminated, champion }) {
  return (
    <div className="flex items-center justify-center">
      {[1, 2, 3].map((r, i) => {
        const match     = matchByRound[r]
        const won       = match?.won
        const isCurrent = r === nextRound && !eliminated && !champion
        const color     = ROUND_COLORS[r - 1]
        return (
          <div key={r} className="flex items-center">
            {i > 0 && (
              <div className={`h-px w-12 sm:w-20 transition-colors duration-500 ${won === true ? 'bg-[#16a34a]' : 'bg-border'}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-extrabold border-2 transition-all duration-300 ${
                  won === true  ? 'bg-[#16a34a] border-[#16a34a] text-white' :
                  won === false ? 'bg-[#dc2626] border-[#dc2626] text-white' :
                  isCurrent     ? 'text-white shadow-[0_0_0_4px_color-mix(in_srgb,var(--cc)_18%,transparent)]' :
                                  'bg-surface-2 border-border text-text-3'
                }`}
                style={isCurrent ? { background: color, borderColor: color, '--cc': color } : {}}
              >
                {won === true ? '✓' : won === false ? '✗' : r}
              </div>
              <span
                className="text-[10px] font-bold tracking-[0.06em] uppercase"
                style={{ color: isCurrent ? color : won != null ? (won ? '#16a34a' : '#dc2626') : 'var(--text-3)' }}
              >
                {ROUND_LABELS[r - 1]}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── WeekStrip ──────────────────────────────────────────────────────────────── */

function WeekStrip({ todayOffset, matchByRound }) {
  return (
    <div className="flex gap-1">
      {WEEK_DAYS.map(d => {
        const isToday = todayOffset === d.offset
        const match   = d.round ? matchByRound[d.round] : null
        const won     = match?.won
        const color   = d.round ? ROUND_COLORS[d.round - 1] : null
        const isFight = d.type === 'fight'

        return (
          <div key={d.offset} className="flex-1 flex flex-col items-center gap-[3px]">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                won === true  ? 'bg-[#16a34a] text-white' :
                won === false ? 'bg-[#dc2626] text-white' :
                isFight       ? 'text-white' :
                                'bg-surface-2 text-text-3'
              }`}
              style={{
                ...(isFight && won == null ? { background: color } : {}),
                ...(isToday ? { outline: `2px solid ${color ?? 'var(--blue-500)'}`, outlineOffset: '2px' } : {}),
              }}
            >
              {won === true ? '✓' : won === false ? '✗' : d.short}
            </div>
            <span className={`text-[9px] font-semibold ${isToday ? 'text-text' : 'text-text-3'}`}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── VSCard ─────────────────────────────────────────────────────────────────── */

const STAT_KEYS   = ['max_hp', 'attack', 'defense', 'strength', 'agility']
const STAT_LABELS = { max_hp: 'HP', attack: 'ATQ', defense: 'DEF', strength: 'FUE', agility: 'AGI' }

function VSCard({ hero, rival, round, onFight, isPending, heroExploring }) {
  const color = ROUND_COLORS[round - 1]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl overflow-hidden border shadow-[var(--shadow-lg)]"
      style={{ borderColor: `color-mix(in srgb,${color} 30%,var(--border))` }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ background: `color-mix(in srgb,${color} 12%,var(--surface))` }}
      >
        <div className="flex items-center gap-2">
          <Flame size={13} strokeWidth={2} style={{ color }} />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color }}>
            {ROUND_LABELS[round - 1]}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-text-3">HOY · Día de combate</span>
      </div>

      {/* Combatants */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-extrabold text-text truncate">{hero?.name ?? '—'}</p>
          <p className="text-[12px] text-text-3 truncate">{hero?.classes?.name ?? 'Héroe'} · Nv.{hero?.level}</p>
        </div>
        <div className="flex-shrink-0 px-3 py-1 rounded-full bg-surface-2 border border-border">
          <span className="text-[12px] font-black text-text-3">VS</span>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-[17px] font-extrabold text-text truncate">{rival.name}</p>
          <p className="text-[12px] text-text-3 truncate">{rival.class} · {rival.spec}</p>
        </div>
      </div>

      {/* Stats comparison */}
      <div className="px-5 pb-4 flex flex-col gap-2">
        {STAT_KEYS.map(stat => {
          const heroVal  = hero?.[stat] ?? 0
          const rivalVal = rival.stats[stat] ?? 0
          const max      = Math.max(heroVal, rivalVal, 1)
          const heroPct  = Math.round((heroVal / max) * 100)
          const rivalPct = Math.round((rivalVal / max) * 100)
          const heroWins = heroVal >= rivalVal

          return (
            <div key={stat} className="flex items-center gap-2">
              {/* Hero side */}
              <div className="flex-1 flex items-center gap-1.5 flex-row-reverse">
                <span className={`text-[11px] font-bold tabular-nums w-8 text-right ${heroWins ? 'text-text' : 'text-text-3'}`}>{heroVal}</span>
                <div className="flex-1 h-[5px] rounded-full bg-[color-mix(in_srgb,var(--border)_60%,transparent)] overflow-hidden flex justify-end">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${heroPct}%` }}
                    transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                    style={{ background: heroWins ? '#16a34a' : '#94a3b8' }}
                  />
                </div>
              </div>

              {/* Label */}
              <span className="text-[10px] font-bold text-text-3 w-7 text-center flex-shrink-0">{STAT_LABELS[stat]}</span>

              {/* Rival side */}
              <div className="flex-1 flex items-center gap-1.5">
                <div className="flex-1 h-[5px] rounded-full bg-[color-mix(in_srgb,var(--border)_60%,transparent)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${rivalPct}%` }}
                    transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                    style={{ background: !heroWins ? '#dc2626' : '#94a3b8' }}
                  />
                </div>
                <span className={`text-[11px] font-bold tabular-nums w-8 ${!heroWins ? 'text-text' : 'text-text-3'}`}>{rivalVal}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <div className="px-4 pb-4">
        <motion.button
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-extrabold text-white border-0 cursor-pointer font-[inherit] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: color }}
          onClick={onFight}
          disabled={isPending || heroExploring}
          animate={!isPending && !heroExploring ? {
            boxShadow: [
              `0 0 0 0 color-mix(in srgb,${color} 0%,transparent)`,
              `0 0 0 10px color-mix(in srgb,${color} 22%,transparent)`,
              `0 0 0 0 color-mix(in srgb,${color} 0%,transparent)`,
            ],
          } : {}}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.01 }}
        >
          <Swords size={17} strokeWidth={2.2} />
          {isPending ? 'Combatiendo...' : `Combatir — ${ROUND_LABELS[round - 1]}`}
        </motion.button>
        {heroExploring && (
          <p className="text-[11px] text-text-3 text-center mt-2">El héroe está en expedición</p>
        )}
      </div>
    </motion.div>
  )
}

/* ── NextBattleCard ─────────────────────────────────────────────────────────── */

function NextBattleCard({ round, windows }) {
  const color = ROUND_COLORS[round - 1]
  const w     = windows?.[round]
  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-4"
      style={{
        background: `color-mix(in srgb,${color} 5%,var(--surface))`,
        borderColor: `color-mix(in srgb,${color} 20%,var(--border))`,
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb,${color} 14%,var(--surface-2))`, color }}
      >
        <Clock size={18} strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-[14px] font-bold text-text">
          Próxima batalla — <span style={{ color }}>{ROUND_LABELS[round - 1]}</span>
        </p>
        {w && (
          <p className="text-[12px] text-text-3 mt-0.5">{fmtDate(w.opens)}</p>
        )}
      </div>
    </div>
  )
}

/* ── MatchResult ────────────────────────────────────────────────────────────── */

function MatchResult({ match, rival, onReplay, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.18 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        match.won
          ? 'bg-[color-mix(in_srgb,#16a34a_5%,var(--surface))] border-[color-mix(in_srgb,#16a34a_20%,var(--border))]'
          : 'bg-[color-mix(in_srgb,#dc2626_5%,var(--surface))] border-[color-mix(in_srgb,#dc2626_20%,var(--border))]'
      }`}
    >
      <span className="text-[20px] leading-none flex-shrink-0">
        {match.won ? '🏆' : '💀'}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-bold ${match.won ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
          {match.won ? 'Victoria' : 'Derrota'} — {ROUND_LABELS[(match.round ?? 1) - 1]}
        </p>
        <p className="text-[12px] text-text-3 truncate">vs {rival?.name}</p>
      </div>
      {match.log?.length > 0 && (
        <button
          className="btn btn--ghost btn--sm flex-shrink-0"
          onClick={onReplay}
        >
          Replay <ChevronRight size={12} strokeWidth={2.5} />
        </button>
      )}
    </motion.div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────────────── */

export default function Torneos() {
  const heroId      = useHeroId()
  const { data: hero } = useHero(heroId)
  const { data, isLoading } = useTournament(heroId)
  const queryClient = useQueryClient()
  const [replay, setReplay] = useState(null)

  const weekStart      = data?.weekStart ?? null
  const availableRound = useMemo(() => getAvailableRound(weekStart), [weekStart])
  const todayOffset    = useMemo(() => getTodayOffset(weekStart), [weekStart])
  const windows        = useMemo(() => weekStart ? getRoundWindows(weekStart) : null, [weekStart])

  const registerMutation = useMutation({
    mutationFn: () => apiPost('/api/tournament-register', { heroId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(heroId) })
      toast.success('¡Inscrito en el torneo!')
    },
    onError: err => toast.error(err.message),
  })

  const fightMutation = useMutation({
    mutationFn: () => apiPost('/api/tournament-fight', { heroId }),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      setReplay({ log: data.log, heroMaxHp: data.heroMaxHp, rivalMaxHp: data.rivalMaxHp, rival: data.rival, won: data.won, rewards: data.rewards })
    },
    onError: err => toast.error(err.message),
  })

  if (isLoading) return <p className="text-text-3 text-[14px] text-center py-16">Cargando torneo...</p>

  const { bracket, matches = [] } = data ?? {}
  const matchByRound = Object.fromEntries(matches.map(m => [m.round, m]))

  /* ── Sin inscripción ────────────────────────────────────────────────────── */
  if (!bracket) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-5"
      >
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,#dc2626_30%,var(--border))] bg-[color-mix(in_srgb,#dc2626_6%,var(--surface))] shadow-[var(--shadow-lg)]">
          <div className="px-6 pt-8 pb-6 flex flex-col items-center gap-5 text-center">
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
            >
              <Trophy size={52} color="#d97706" strokeWidth={1.4} />
            </motion.div>
            <div>
              <p className="font-display text-[26px] font-extrabold tracking-[0.04em] text-text leading-tight">
                Torneo Semanal
              </p>
              <p className="text-[13px] text-text-3 mt-1.5 max-w-sm mx-auto leading-relaxed">
                3 rondas de combate PvE. Un día para demostrar que eres el más fuerte.
              </p>
            </div>

            {/* Schedule */}
            <div className="w-full max-w-xs flex items-center justify-between gap-1 text-[11px]">
              {[
                { label: 'Lun', type: 'grace', text: 'Inscripciones' },
                { label: 'Mar', type: 'fight', round: 1, text: 'Cuartos'   },
                { label: 'Jue', type: 'fight', round: 2, text: 'Semis'     },
                { label: 'Sáb', type: 'fight', round: 3, text: 'Final'     },
              ].map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px]"
                    style={d.round
                      ? { background: ROUND_COLORS[d.round - 1], color: '#fff' }
                      : { background: 'var(--surface-2)', color: 'var(--text-3)' }
                    }
                  >
                    {d.label}
                  </div>
                  <span className="text-text-3 font-medium">{d.text}</span>
                </div>
              ))}
            </div>

            {/* Rewards */}
            <div className="flex flex-col gap-1.5 w-full max-w-xs text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-3 mb-0.5">Recompensas</p>
              {[
                { icon: Coins,    color: '#d97706', text: 'Cuartos — 100 oro + 50 XP',          round: 1 },
                { icon: Sparkles, color: '#7c3aed', text: 'Semifinal — 200 oro + 20 maná',       round: 2 },
                { icon: Trophy,   color: '#d97706', text: 'Final — 500 oro + carta garantizada', round: 3 },
              ].map(({ icon: Icon, color, text, round }) => (
                <div key={round} className="flex items-center gap-2 text-[12px] text-text-2">
                  <Icon size={13} color={color} strokeWidth={2} />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <motion.button
              className="btn btn--primary btn--lg min-w-[200px] mt-1"
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending || !heroId}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Shield size={16} strokeWidth={2} />
              {registerMutation.isPending ? 'Inscribiendo...' : 'Inscribirse al torneo'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    )
  }

  /* ── Con inscripción ──────────────────────────────────────────────────────── */
  const nextRound  = bracket.current_round + 1
  const canFight   = !bracket.eliminated && !bracket.champion && availableRound === nextRound

  return (
    <div className="flex flex-col gap-4">

      {/* Champion */}
      {bracket.champion && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-[color-mix(in_srgb,#d97706_35%,var(--border))] bg-[color-mix(in_srgb,#d97706_8%,var(--surface))] px-6 py-8 flex flex-col items-center gap-3 text-center shadow-[var(--shadow-lg)]"
        >
          <motion.span
            className="text-[52px] leading-none"
            animate={{ rotate: [-5, 5, -5] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          >
            🏆
          </motion.span>
          <div>
            <p className="font-display text-[22px] font-extrabold text-[#d97706]">¡Campeón de la semana!</p>
            <p className="text-[13px] text-text-3 mt-1">Has conquistado el torneo. El próximo empieza el lunes.</p>
          </div>
        </motion.div>
      )}

      {/* Eliminated */}
      {bracket.eliminated && !bracket.champion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-[color-mix(in_srgb,#dc2626_25%,var(--border))] bg-[color-mix(in_srgb,#dc2626_5%,var(--surface))] px-5 py-6 flex items-center gap-4"
        >
          <Skull size={32} color="#dc2626" strokeWidth={1.4} className="flex-shrink-0" />
          <div>
            <p className="text-[16px] font-extrabold text-[#dc2626]">Eliminado</p>
            <p className="text-[13px] text-text-3 mt-0.5">El próximo torneo empieza el lunes</p>
          </div>
        </motion.div>
      )}

      {/* Bracket + week — siempre visible si está inscrito */}
      {!bracket.champion && (
        <div className="bg-surface border border-border rounded-xl px-4 py-4 flex flex-col gap-4 shadow-[var(--shadow-sm)]">
          <BracketPath
            matchByRound={matchByRound}
            nextRound={nextRound}
            eliminated={bracket.eliminated}
            champion={bracket.champion}
          />
          <WeekStrip todayOffset={todayOffset} matchByRound={matchByRound} />
        </div>
      )}

      {/* Fight day — VS card */}
      {canFight && (
        <VSCard
          hero={hero}
          rival={bracket.rivals[nextRound - 1]}
          round={nextRound}
          onFight={() => fightMutation.mutate()}
          isPending={fightMutation.isPending}
          heroExploring={hero?.status === 'exploring'}
        />
      )}

      {/* Waiting for next round */}
      {!bracket.eliminated && !bracket.champion && !canFight && availableRound !== nextRound && windows && nextRound <= 3 && (
        <NextBattleCard round={nextRound} windows={windows} />
      )}

      {/* Past results */}
      {matches.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3 px-1">Resultados</span>
          {matches.map((match, i) => (
            <MatchResult
              key={match.id ?? i}
              match={match}
              rival={bracket.rivals?.[match.round - 1]}
              index={i}
              onReplay={() => setReplay({ ...match, rival: bracket.rivals?.[match.round - 1] })}
            />
          ))}
        </div>
      )}

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
