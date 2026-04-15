import { useState, useReducer, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords, Users, Heart, AlertTriangle, Coins, Star, ChevronRight, CheckCircle, XCircle, Shield, Trophy } from 'lucide-react'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { queryKeys } from '../lib/queryKeys'
import { teamCombatsKey } from '../hooks/useTeamCombats'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { computeSynergy } from '../lib/teamSynergy'
import { trainingRewards } from '../lib/gameFormulas'
import { tierForRating } from '../lib/combatRating'

// ── Constantes de presentación ───────────────────────────────────────────────

const CLASS_COLOR = {
  caudillo:  '#dc2626',
  arcanista: '#7c3aed',
  sombra:    '#0369a1',
  domador:   '#16a34a',
  universal: '#d97706',
}

const CLASS_LABEL = {
  caudillo:  'Caudillo',
  arcanista: 'Arcanista',
  sombra:    'Sombra',
  domador:   'Domador',
  universal: 'Universal',
}

const CONFIG = {
  3: {
    previewEndpoint: '/api/team-combat-preview',
    fightEndpoint:   '/api/team-combat',
    winOf:           2,
    rewardGoldMult:  3.0,
    rewardXpMult:    1.5,
    winText:         'Gana 2 de 3 duelos',
    title:           'Escuadrón 3v3',
    subtitle:        size => size === 3
      ? 'Elige 3 héroes, busca rival y asigna los matchups. Gana 2 de 3 duelos.'
      : 'Tu trío completo entra al combate. La diversidad de clases activa sinergias poderosas.',
  },
  5: {
    previewEndpoint: '/api/team-combat-5v5-preview',
    fightEndpoint:   '/api/team-combat-5v5',
    winOf:           3,
    rewardGoldMult:  5.0,
    rewardXpMult:    2.0,
    winText:         'Gana 3 de 5 duelos',
    title:           'Gran Escuadrón 5v5',
    subtitle:        size => size === 5
      ? 'Tu escuadrón completo entra al campo de batalla. Gana 3 de 5 duelos.'
      : 'Elige 5 héroes y asigna los matchups. Gana 3 de 5 duelos para la victoria.',
  },
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

function ClassBadge({ cls, small }) {
  const color = CLASS_COLOR[cls] ?? '#6b7280'
  return (
    <span
      className={`font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border ${small ? 'text-[9px]' : 'text-[10px]'}`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, var(--surface-2))`,
        borderColor: `color-mix(in srgb, ${color} 25%, var(--border))`,
      }}
    >
      {CLASS_LABEL[cls] ?? cls}
    </span>
  )
}

function SynergyBadge({ synergy }) {
  if (!synergy) return null
  const isBonus = synergy.attackPct > 0
  const isMalus = synergy.attackPct < 0
  const color   = isBonus ? '#16a34a' : isMalus ? '#dc2626' : '#6b7280'
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
      style={{
        background: `color-mix(in srgb, ${color} 8%, var(--surface-2))`,
        borderColor: `color-mix(in srgb, ${color} 30%, var(--border))`,
      }}
    >
      <Users size={13} strokeWidth={2} style={{ color }} />
      <span className="text-[12px] font-extrabold flex-1" style={{ color }}>{synergy.label}</span>
      {synergy.attackPct !== 0 && (
        <span className="text-[12px] font-bold tabular-nums" style={{ color }}>
          {isBonus ? '+' : ''}{Math.round(synergy.attackPct * 100)}% atk/def
        </span>
      )}
    </div>
  )
}

// Carta de héroe compacta para el selector
function HeroChip({ hero, selected, disabled, onSelect }) {
  const nowMs = Date.now()
  const hpNow = interpolateHp(hero, nowMs)
  const busy  = hero.status !== 'idle'
  const lowHp = hpNow < Math.floor(hero.max_hp * 0.2)
  const unavailable = busy || lowHp
  const color = CLASS_COLOR[hero.class] ?? '#6b7280'

  return (
    <button
      type="button"
      onClick={() => !disabled && !unavailable && onSelect(hero.id)}
      disabled={disabled || unavailable}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-[border-color,background] duration-150 disabled:cursor-not-allowed"
      style={{
        borderColor: selected ? color : 'var(--border)',
        background: selected
          ? `color-mix(in srgb, ${color} 12%, var(--surface))`
          : 'var(--surface-2)',
        opacity: unavailable ? 0.5 : 1,
      }}
    >
      <span className="text-[12px] font-bold text-text truncate max-w-[70px]">{hero.name}</span>
      <ClassBadge cls={hero.class} small />
      {unavailable && (
        <span className="text-[9px] font-bold text-[#dc2626]">{busy ? 'ocupado' : 'HP bajo'}</span>
      )}
    </button>
  )
}

// Carta de héroe seleccionado (expandida, en la fase idle)
function HeroSelectCard({ hero, selected, disabled, onToggle, nowMs }) {
  const hpNow = interpolateHp(hero, nowMs)
  const pct   = Math.round((hpNow / hero.max_hp) * 100)
  const busy  = hero.status !== 'idle'
  const lowHp = hpNow < Math.floor(hero.max_hp * 0.2)
  const canUse = !busy && !lowHp
  const color = CLASS_COLOR[hero.class] ?? '#6b7280'

  return (
    <motion.button
      type="button"
      onClick={() => canUse && !disabled && onToggle(hero.id)}
      disabled={!canUse || disabled}
      className="flex flex-col gap-1.5 p-3 rounded-xl border-2 text-left w-full transition-[border-color,background] duration-150 disabled:cursor-not-allowed bg-transparent"
      style={{
        borderColor: selected ? color : 'var(--border)',
        background: selected
          ? `color-mix(in srgb, ${color} 10%, var(--surface))`
          : 'var(--surface)',
        opacity: canUse ? 1 : 0.7,
      }}
      whileTap={canUse && !disabled ? { scale: 0.97 } : {}}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold text-text truncate">{hero.name}</span>
        <ClassBadge cls={hero.class} />
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-text-3 font-semibold">
        <span>Nv.{hero.level}</span>
        <span>·</span>
        <Heart size={10} strokeWidth={2.5} />
        <span className="tabular-nums">{Math.round(pct)}%</span>
        {busy  && <span className="text-[#d97706] font-bold ml-1">En expedición</span>}
        {!busy && lowHp && <span className="text-[#dc2626] font-bold ml-1">HP &lt; 20%</span>}
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, pct)}%`, background: pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626' }}
        />
      </div>
      {selected && (
        <div className="flex items-center gap-1 mt-0.5">
          <CheckCircle size={11} strokeWidth={2.5} style={{ color }} />
          <span className="text-[10px] font-bold" style={{ color }}>Seleccionado</span>
        </div>
      )}
    </motion.button>
  )
}

// Fila de matchup: un enemigo vs un héroe asignado
function MatchupRow({ enemy, heroOptions, assignedHeroId, onAssign, disabled }) {
  const color = CLASS_COLOR[enemy.class] ?? '#6b7280'
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-surface-2">
      {/* Enemy */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 15%, var(--surface))`, border: `1px solid color-mix(in srgb, ${color} 30%, var(--border))` }}
        >
          <Swords size={13} strokeWidth={2} style={{ color }} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-extrabold text-text truncate">{enemy.name}</span>
          <ClassBadge cls={enemy.class} small />
        </div>
        <ChevronRight size={14} strokeWidth={2} className="text-text-3 flex-shrink-0 ml-auto" />
      </div>

      {/* Hero picker */}
      <div className="flex flex-wrap gap-1.5 pl-9">
        {heroOptions.map(hero => (
          <HeroChip
            key={hero.id}
            hero={hero}
            selected={assignedHeroId === hero.id}
            disabled={disabled}
            onSelect={(id) => onAssign(id)}
          />
        ))}
      </div>
    </div>
  )
}

// Tarjeta de resultado de un duelo
function DuelResultCard({ duel }) {
  const heroHpPct  = Math.round((duel.heroHpLeft  / duel.heroMaxHp)  * 100)
  const enemyHpPct = Math.round((duel.enemyHpLeft / duel.enemyMaxHp) * 100)
  const heroColor  = CLASS_COLOR[duel.heroClass]  ?? '#6b7280'
  const enemyColor = CLASS_COLOR[duel.enemyClass] ?? '#6b7280'

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-xl border"
      style={{
        borderColor: duel.won
          ? 'color-mix(in srgb, #16a34a 35%, var(--border))'
          : 'color-mix(in srgb, #dc2626 25%, var(--border))',
        background: duel.won
          ? 'color-mix(in srgb, #16a34a 6%, var(--surface))'
          : 'color-mix(in srgb, #dc2626 5%, var(--surface))',
      }}
    >
      <div className="flex items-center gap-2">
        {duel.won
          ? <CheckCircle size={15} strokeWidth={2.5} className="text-[#16a34a] flex-shrink-0" />
          : <XCircle     size={15} strokeWidth={2.5} className="text-[#dc2626] flex-shrink-0" />
        }
        <span className="text-[12px] font-extrabold" style={{ color: duel.won ? '#16a34a' : '#dc2626' }}>
          {duel.won ? 'Victoria' : 'Derrota'}
        </span>
        <span className="text-[10px] text-text-3 ml-auto tabular-nums">{duel.rounds} rondas</span>
      </div>

      {/* Hero vs Enemy */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* Hero side */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold text-text truncate">{duel.heroName}</span>
          <ClassBadge cls={duel.heroClass} small />
          <div className="flex items-center gap-1 text-[10px] text-text-3 mt-0.5">
            <Heart size={9} strokeWidth={2.5} />
            <span className="tabular-nums">{Math.max(0, Math.round(duel.heroHpLeft))}/{duel.heroMaxHp}</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(0, heroHpPct)}%`, background: heroColor }}
            />
          </div>
        </div>

        <span className="text-[11px] font-extrabold text-text-3">VS</span>

        {/* Enemy side */}
        <div className="flex flex-col gap-1 items-end text-right">
          <span className="text-[12px] font-bold text-text truncate">{duel.enemyName}</span>
          <ClassBadge cls={duel.enemyClass} small />
          <div className="flex items-center gap-1 text-[10px] text-text-3 justify-end mt-0.5">
            <Heart size={9} strokeWidth={2.5} />
            <span className="tabular-nums">{Math.max(0, Math.round(duel.enemyHpLeft))}/{duel.enemyMaxHp}</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden w-full">
            <div
              className="h-full rounded-full transition-all ml-auto"
              style={{ width: `${Math.max(0, enemyHpPct)}%`, background: enemyColor, float: 'right' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function TeamCombat({ size = 3 }) {
  const cfg = CONFIG[size]

  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const queryClient          = useQueryClient()
  const { heroes, loading }  = useHeroes(userId)
  const [, forceUpdate]      = useReducer(x => x + 1, 0)

  // Phase: idle | searching | found | fighting | result
  const [phase,    setPhase]    = useState('idle')
  const [selected, setSelected] = useState([])
  const [preview,  setPreview]  = useState(null)
  const [matchups, setMatchups] = useState({})   // { enemyIndex: heroId }
  const [result,   setResult]   = useState(null)

  useEffect(() => {
    const id = setInterval(forceUpdate, 15000)
    return () => clearInterval(id)
  }, [])

  const nowMs = Date.now()

  // Auto-seleccionar si hay exactamente `size` héroes
  useEffect(() => {
    if (heroes.length === size && selected.length === 0) {
      setSelected(heroes.map(h => h.id))
    }
  }, [heroes, selected.length, size])

  function toggleHero(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= size) return prev
      return [...prev, id]
    })
  }

  const selectedHeroes = selected.map(id => (heroes ?? []).find(h => h.id === id)).filter(Boolean)
  const synergy        = selectedHeroes.length === size ? computeSynergy(selectedHeroes.map(h => h.class)) : null
  const avgLevel       = selectedHeroes.length === size
    ? Math.max(1, Math.round(selectedHeroes.reduce((a, h) => a + h.level, 0) / size))
    : 1
  const baseRewards = trainingRewards(avgLevel)
  const estGold     = Math.round(baseRewards.gold * cfg.rewardGoldMult)
  const estXp       = Math.round(baseRewards.experience * cfg.rewardXpMult)

  const blockers = selectedHeroes.map(h => {
    if (h.status !== 'idle') return { name: h.name, reason: 'en expedición' }
    const hpNow = interpolateHp(h, nowMs)
    if (hpNow < Math.floor(h.max_hp * 0.2)) return { name: h.name, reason: 'HP < 20%' }
    return null
  }).filter(Boolean)

  const previewMutation = useMutation({
    mutationFn: () => apiPost(cfg.previewEndpoint, { heroIds: selected }),
    onMutate: () => setPhase('searching'),
    onSuccess: (data) => { setPreview(data); setMatchups({}); setPhase('found') },
    onError:   (err)  => { setPhase('idle'); notify.error(err.message) },
  })

  const combatMutation = useMutation({
    mutationFn: () => {
      const matchupsArr = Object.entries(matchups).map(([enemyIndex, heroId]) => ({
        heroId,
        enemyIndex: Number(enemyIndex),
      }))
      return apiPost(cfg.fightEndpoint, {
        previewToken: preview.token,
        heroIds: selected,
        matchups: matchupsArr,
      })
    },
    onMutate: () => setPhase('fighting'),
    onSuccess: (data) => {
      setResult(data)
      setPhase('result')
      if (data.won) {
        triggerResourceFlash()
        queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
      queryClient.invalidateQueries({ queryKey: teamCombatsKey(userId) })
      queryClient.invalidateQueries({ queryKey: ['team-ranking'] })
    },
    onError: (err) => { setPhase('found'); notify.error(err.message) },
  })

  function resetToIdle() {
    setPhase('idle')
    setPreview(null)
    setMatchups({})
    setResult(null)
    if (heroes.length !== size) setSelected([])
  }

  // ── Pantallas ──────────────────────────────────────────────────────────────

  if (loading) return <div className="text-text-3 text-[14px] p-10 text-center">Cargando héroes...</div>

  if ((heroes?.length ?? 0) < size) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <div className="section-header">
          <h2 className="section-title">{cfg.title}</h2>
          <p className="section-subtitle">Combates por equipos. Asigna tus héroes contra el rival y {cfg.winText.toLowerCase()}.</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center">
          <AlertTriangle size={32} className="text-[#d97706]" strokeWidth={1.8} />
          <p className="text-[15px] font-bold text-text">Necesitas al menos {size} héroes</p>
          <p className="text-[13px] text-text-3 max-w-sm">
            Desbloquea nuevos slots de héroe en la Base para activar los combates {size}v{size}.
          </p>
        </div>
      </div>
    )
  }

  // ── Fase: resultado ────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const won = result.won
    const resultColor = won ? '#16a34a' : '#dc2626'
    return (
      <div className="flex flex-col gap-4 pb-8">
        <div
          className="flex flex-col items-center gap-2 px-4 py-5 rounded-xl border"
          style={{
            background: `color-mix(in srgb, ${resultColor} 8%, var(--surface))`,
            borderColor: `color-mix(in srgb, ${resultColor} 30%, var(--border))`,
          }}
        >
          {won
            ? <Trophy size={32} strokeWidth={1.8} style={{ color: resultColor }} />
            : <XCircle size={32} strokeWidth={1.8} style={{ color: resultColor }} />
          }
          <span className="text-[20px] font-extrabold" style={{ color: resultColor }}>
            {won ? '¡Victoria!' : 'Derrota'}
          </span>
          <span className="text-[14px] font-bold text-text-2">{result.score} duelos</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Duelos</span>
          {(result.duels ?? []).sort((a, b) => a.enemyIndex - b.enemyIndex).map((duel, i) => (
            <DuelResultCard key={i} duel={duel} />
          ))}
        </div>

        {won && result.rewards && (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3 mr-auto">Recompensas</span>
            <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
              <Coins size={13} color="#d97706" strokeWidth={2} />+{result.rewards.gold} oro
            </span>
            <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
              <Star size={13} color="#0369a1" strokeWidth={2} />+{result.rewards.xpPerHero} XP c/u
            </span>
          </div>
        )}

        {(result.ratings ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Rating</span>
            {result.ratings.map(r => {
              const tier  = tierForRating(r.current)
              const color = tier.color
              const delta = r.delta
              return (
                <div key={r.heroId} className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-lg">
                  <Shield size={13} strokeWidth={2} style={{ color }} />
                  <span className="text-[12px] font-bold text-text flex-1">{r.heroName}</span>
                  <span className="text-[11px] font-bold" style={{ color }}>{tier.label}</span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: delta >= 0 ? '#16a34a' : '#dc2626' }}>
                    {delta >= 0 ? '+' : ''}{delta}
                  </span>
                  {r.promoted && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#f59e0b] bg-[color-mix(in_srgb,#f59e0b_12%,var(--surface))] border border-[color-mix(in_srgb,#f59e0b_30%,var(--border))] px-1.5 py-0.5 rounded">
                      Ascenso
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <motion.button className="btn btn--primary btn--lg btn--full" onClick={resetToIdle} whileTap={{ scale: 0.96 }}>
          <Swords size={16} strokeWidth={2} />
          Nueva batalla
        </motion.button>
      </div>
    )
  }

  // ── Fase: buscando rival / librando duelos ─────────────────────────────────
  if (phase === 'searching' || phase === 'fighting') {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center gap-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
            <Swords size={28} strokeWidth={1.8} className="text-text-3" />
          </motion.div>
          <p className="text-[14px] font-bold text-text-2">
            {phase === 'searching' ? 'Buscando rival...' : `Librando ${size} duelos...`}
          </p>
        </div>
      </div>
    )
  }

  // ── Fase: asignación de matchups ───────────────────────────────────────────
  if (phase === 'found' && preview) {
    const enemies    = preview.enemies
    const allAssigned = enemies.every((_, i) => matchups[i] != null)

    function assignHero(enemyIndex, heroId) {
      setMatchups(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => { if (next[k] === heroId) delete next[k] })
        next[enemyIndex] = heroId
        return next
      })
    }

    return (
      <div className="flex flex-col gap-4 pb-8">
        <div className="section-header">
          <h2 className="section-title">Asigna tus héroes</h2>
          <p className="section-subtitle">Elige quién lucha contra cada rival. {cfg.winText} para la victoria.</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3 flex-1">Equipo rival</span>
            <span className="text-[11px] font-bold text-text-3 tabular-nums">{Object.keys(matchups).length}/{size} asignados</span>
          </div>
          {enemies.map((enemy, i) => (
            <MatchupRow
              key={i}
              enemy={enemy}
              heroOptions={selectedHeroes}
              assignedHeroId={matchups[i] ?? null}
              onAssign={(heroId) => assignHero(i, heroId)}
              disabled={combatMutation.isPending}
            />
          ))}
        </div>

        {!allAssigned && (
          <p className="text-[12px] text-text-3 text-center">Asigna un héroe a cada rival para continuar</p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={resetToIdle} className="btn btn--ghost flex-shrink-0 px-4">
            Volver
          </button>
          <motion.button
            className="btn btn--primary btn--lg flex-1"
            onClick={() => combatMutation.mutate()}
            disabled={!allAssigned || combatMutation.isPending}
            whileTap={allAssigned ? { scale: 0.96 } : {}}
          >
            <Swords size={16} strokeWidth={2} />
            Iniciar {size} duelos
          </motion.button>
        </div>
      </div>
    )
  }

  // ── Fase: idle ─────────────────────────────────────────────────────────────
  const canSearch  = selected.length === size && blockers.length === 0 && !previewMutation.isPending
  const autoLocked = heroes.length === size
  const remaining  = size - selected.length

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">{cfg.title}</h2>
        <p className="section-subtitle">
          {autoLocked
            ? `Tu escuadrón completo entra al combate. La diversidad de clases activa sinergias poderosas.`
            : `Elige ${size} héroes, busca rival y asigna los matchups. ${cfg.winText}.`}
        </p>
      </div>

      {/* Selector de héroes */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">
            {autoLocked ? 'Tu escuadrón' : 'Alineación'}
          </span>
          <span className="text-[12px] font-bold text-text-2 tabular-nums">{selected.length}/{size}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(heroes ?? []).map(h => (
            <HeroSelectCard
              key={h.id}
              hero={h}
              selected={selected.includes(h.id)}
              disabled={previewMutation.isPending || (!autoLocked && selected.length >= size && !selected.includes(h.id))}
              onToggle={toggleHero}
              nowMs={nowMs}
            />
          ))}
        </div>
      </div>

      {/* Preview: sinergia + recompensas estimadas */}
      {selected.length === size && (
        <AnimatePresence>
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-2"
          >
            <SynergyBadge synergy={synergy} />

            <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3 mr-auto">Recompensa al ganar</span>
              <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
                <Coins size={13} color="#d97706" strokeWidth={2} />+{estGold} oro
              </span>
              <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
                <Star size={13} color="#0369a1" strokeWidth={2} />+{estXp} XP c/u
              </span>
            </div>

            {blockers.length > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 bg-[color-mix(in_srgb,#dc2626_8%,var(--surface-2))] border border-[color-mix(in_srgb,#dc2626_25%,var(--border))] rounded-lg">
                <AlertTriangle size={14} className="text-[#dc2626] mt-0.5 flex-shrink-0" strokeWidth={2} />
                <span className="text-[11px] text-[#dc2626] font-semibold">
                  {blockers.map(b => `${b.name} (${b.reason})`).join(', ')}
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <motion.button
        className="btn btn--primary btn--lg btn--full"
        onClick={() => previewMutation.mutate()}
        disabled={!canSearch}
        whileTap={canSearch ? { scale: 0.96 } : {}}
        whileHover={canSearch ? { scale: 1.01 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Users size={16} strokeWidth={2} />
        {remaining > 0
          ? `Elige ${remaining} ${remaining === 1 ? 'héroe' : 'héroes'} más`
          : blockers.length > 0
            ? 'Escuadrón no disponible'
            : 'Buscar rival'}
      </motion.button>
    </div>
  )
}
