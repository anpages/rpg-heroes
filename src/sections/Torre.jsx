import { useState, useEffect, useReducer } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useHeroCards } from '../hooks/useHeroCards'
import { useTowerProgress } from '../hooks/useTowerProgress'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { Swords, Star, Coins, Trophy, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'

const MILESTONES = [5, 10, 25, 50, 100]
// Posición % de cada milestone en la barra (relativa al máximo = 100)
const MILESTONE_PCT = [5, 10, 25, 50, 100]

const ENEMY_NAMES = [
  [1,  5,  'Guardián'],
  [6,  10, 'Centinela'],
  [11, 20, 'Campeón'],
  [21, 50, 'Élite'],
  [51, 999,'Legendario'],
]

function enemyName(floor) {
  return ENEMY_NAMES.find(([lo, hi]) => floor >= lo && floor <= hi)?.[2] ?? 'Guardián'
}

function floorEnemyStats(floor) {
  return {
    max_hp:        80  + floor * 15,
    attack:         5  + floor * 2,
    defense:        2  + floor * 1,
    strength:       2  + Math.floor(floor * 0.5),
    agility:        2  + Math.floor(floor * 0.3),
    intelligence:   1  + Math.floor(floor * 0.3),
  }
}

function floorRewards(floor) {
  const milestone = floor % 5 === 0
  return {
    gold:       Math.round((30 + floor * 15) * (milestone ? 2 : 1)),
    experience: Math.round((20 + floor * 10) * (milestone ? 2 : 1)),
    milestone,
  }
}

/* ─── Progress strip ─────────────────────────────────────────────────────────── */

function ProgressStrip({ maxFloor }) {
  const reached = maxFloor ?? 0
  const nextMs  = MILESTONES.find(m => m > reached) ?? MILESTONES[MILESTONES.length - 1]
  const prevMs  = [...MILESTONES].reverse().find(m => m <= reached) ?? 0
  const pct     = nextMs === prevMs ? 100 : Math.min(100, Math.round(((reached - prevMs) / (nextMs - prevMs)) * 100))

  return (
    <div className="bg-surface border border-border rounded-xl px-5 pt-4 pb-5 flex flex-col gap-2.5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy size={15} color="#d97706" strokeWidth={2} />
          <span className="text-[22px] font-extrabold text-text leading-none">{reached}</span>
          <span className="text-[11px] text-text-3 font-medium">piso máximo</span>
        </div>
        <span className="text-[12px] text-text-3 font-medium">Hito: piso {nextMs}</span>
      </div>

      {/* Bar + dots */}
      <div className="relative">
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-[linear-gradient(90deg,#d97706,#f59e0b)] rounded-full transition-[width] duration-[400ms] ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Milestone dots — posición calculada en JS */}
        <div className="absolute inset-0 h-1.5 pointer-events-none">
          {MILESTONES.map((m, i) => (
            <div
              key={m}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-surface transition-[background] duration-300"
              style={{
                left: `${MILESTONE_PCT[i]}%`,
                background: reached >= m ? '#d97706' : 'var(--border-2)',
              }}
              title={`Piso ${m}`}
            >
              <span className="absolute top-2.5 left-1/2 -translate-x-1/2 text-[9px] text-text-3 whitespace-nowrap font-medium">
                {m}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Stat comparison row ────────────────────────────────────────────────────── */

function StatCompareRow({ label, heroVal, enemyVal, heroDisplay }) {
  const heroWins  = heroVal > enemyVal
  const enemyWins = enemyVal > heroVal
  const max       = Math.max(heroVal, enemyVal, 1)
  const heroPct   = Math.round((heroVal  / max) * 100)
  const enemyPct  = Math.round((enemyVal / max) * 100)

  const heroColor  = heroWins  ? 'var(--blue-500)'  : enemyWins ? 'var(--border-2)' : 'var(--border-2)'
  const enemyColor = enemyWins ? '#ef4444'           : heroWins  ? 'var(--border-2)' : 'var(--border-2)'

  return (
    <div className="grid grid-cols-[1fr_52px_1fr] items-center gap-2 py-[5px]">
      {/* Héroe — valor + barra que crece hacia la derecha */}
      <div className="flex items-center gap-2 justify-end flex-row-reverse">
        <div className="flex-1 h-[6px] bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${heroPct}%`, background: heroColor, transition: 'width 400ms ease-out' }}
          />
        </div>
        <span className={`text-[13px] font-bold tabular-nums whitespace-nowrap flex-shrink-0 ${heroWins ? 'text-[var(--blue-600)]' : 'text-text-3'}`}>
          {heroDisplay ?? heroVal}
        </span>
      </div>

      {/* Label central */}
      <span className="text-[10px] font-bold text-text-3 text-center uppercase tracking-[0.08em] leading-none">
        {label}
      </span>

      {/* Enemigo — barra que crece hacia la izquierda + valor */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-[6px] bg-border rounded-full overflow-hidden" style={{ direction: 'rtl' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${enemyPct}%`, background: enemyColor, transition: 'width 400ms ease-out' }}
          />
        </div>
        <span className={`text-[13px] font-bold tabular-nums flex-shrink-0 ${enemyWins ? 'text-[#ef4444]' : 'text-text-3'}`}>
          {enemyVal}
        </span>
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

function estimateDamageTaken(hero, enemy) {
  if (!hero || !enemy) return null
  const physDmg = (atk, str, def) => Math.max(1, Math.round((atk + Math.floor(str * 0.3)) * (1 - def / (def + 60))))
  const dmgA = physDmg(hero.attack ?? 0, hero.strength ?? 0, enemy.defense) + Math.floor((hero.intelligence ?? 0) * 0.04)
  const dmgB = physDmg(enemy.attack, enemy.strength, hero.defense ?? 0) + Math.floor(enemy.intelligence * 0.04)
  let hpA = hero.max_hp, hpB = enemy.max_hp
  const aFirst = (hero.agility ?? 0) >= enemy.agility
  for (let r = 1; r <= 30 && hpA > 0 && hpB > 0; r++) {
    if (aFirst) { hpB = Math.max(0, hpB - dmgA); if (hpB > 0) hpA = Math.max(0, hpA - dmgB) }
    else        { hpA = Math.max(0, hpA - dmgB); if (hpA > 0) hpB = Math.max(0, hpB - dmgA) }
    if (hpA <= 0 || hpB <= 0) break
  }
  return hero.max_hp - Math.max(0, hpA)
}


export default function Torre() {
  const userId      = useAppStore(s => s.userId)
  const heroId      = useHeroId()
  const queryClient = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { items } = useInventory(hero?.id)
  const { cards } = useHeroCards(hero?.id)
  const { maxFloor, loading: towerLoading } = useTowerProgress(hero?.id)
  const [result, setResult]   = useState(null)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()

  // Bonos de equipo (durabilidad > 0) + cartas equipadas — necesario antes del render
  const equipBonuses = (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .reduce((acc, i) => {
      const c = i.item_catalog
      acc.attack   += c.attack_bonus   ?? 0
      acc.defense  += c.defense_bonus  ?? 0
      acc.max_hp   += c.hp_bonus       ?? 0
      acc.strength += c.strength_bonus ?? 0
      acc.agility  += c.agility_bonus  ?? 0
      return acc
    }, { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0 })

  const cardBonuses = (cards ?? [])
    .filter(c => c.equipped)
    .reduce((acc, c) => {
      const sc = c.skill_cards
      const r  = c.rank
      acc.attack   += (sc.attack_bonus   ?? 0) * r
      acc.defense  += (sc.defense_bonus  ?? 0) * r
      acc.max_hp   += (sc.hp_bonus       ?? 0) * r
      acc.strength += (sc.strength_bonus ?? 0) * r
      acc.agility  += (sc.agility_bonus  ?? 0) * r
      return acc
    }, { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0 })

  const effectiveHero = hero ? {
    max_hp:       hero.max_hp       + equipBonuses.max_hp    + cardBonuses.max_hp,
    attack:       hero.attack       + equipBonuses.attack    + cardBonuses.attack,
    defense:      hero.defense      + equipBonuses.defense   + cardBonuses.defense,
    strength:     hero.strength     + equipBonuses.strength  + cardBonuses.strength,
    agility:      hero.agility      + equipBonuses.agility   + cardBonuses.agility,
    intelligence: hero.intelligence,
  } : null

  // HP efectivo: usa max_hp con bonificaciones de equipo y cartas como techo
  const effectiveMaxHp = effectiveHero?.max_hp ?? hero?.max_hp ?? 100
  const hpNow          = interpolateHp(hero, nowMs, effectiveMaxHp)
  const minHp          = Math.floor(effectiveMaxHp * 0.2)
  const hasEnoughHp    = hpNow >= minHp

  const targetFloor = (maxFloor ?? 0) + 1
  const enemy       = floorEnemyStats(targetFloor)
  const rewards     = floorRewards(targetFloor)
  const isBusy      = hero?.status !== 'idle'
  const estDamage   = estimateDamageTaken(effectiveHero, enemy)

  const attemptMutation = useMutation({
    mutationFn: () => apiPost('/api/tower-attempt', { heroId: hero?.id }),
    onSuccess: (data) => {
      setResult(data)
      if (data.won) {
        queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      }
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.towerProgress(hero?.id) })
    },
  })

  if (heroLoading || towerLoading) return <div className="text-text-3 text-[14px] p-10 text-center">Cargando torre...</div>

  const guaranteedKo = estDamage !== null && hpNow <= estDamage

  // HP row usa hpNow para que la predicción refleje el estado real
  // heroDisplay muestra la proyección de HP tras el combate estimado
  const hpAfterCombat = estDamage !== null ? Math.max(0, hpNow - estDamage) : null
  const hpDisplay = estDamage !== null
    ? <span className="text-[14px] font-bold tabular-nums">
        {hpNow}
        <span className="text-text-3 font-normal"> → </span>
        <span className={guaranteedKo ? 'text-[#dc2626]' : 'text-[#16a34a]'}>
          {guaranteedKo ? 'KO' : hpAfterCombat}
        </span>
      </span>
    : `${hpNow}/${effectiveMaxHp}`

  const HERO_STATS = [
    { label: 'HP',  heroVal: hpNow,                        enemyVal: enemy.max_hp,   heroDisplay: hpDisplay },
    { label: 'Atq', heroVal: effectiveHero?.attack   ?? 0, enemyVal: enemy.attack   },
    { label: 'Def', heroVal: effectiveHero?.defense  ?? 0, enemyVal: enemy.defense  },
    { label: 'Fue', heroVal: effectiveHero?.strength ?? 0, enemyVal: enemy.strength },
    { label: 'Agi', heroVal: effectiveHero?.agility  ?? 0, enemyVal: enemy.agility  },
  ]

  const heroAdvantages = HERO_STATS.filter(s => s.heroVal > s.enemyVal).length
  const predictionClass = heroAdvantages >= 3
    ? 'text-[#15803d] bg-[color-mix(in_srgb,#16a34a_12%,var(--surface))] border border-[color-mix(in_srgb,#16a34a_25%,var(--border))]'
    : heroAdvantages >= 2
      ? 'text-[#b45309] bg-[color-mix(in_srgb,#d97706_12%,var(--surface))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))]'
      : 'text-[#dc2626] bg-[color-mix(in_srgb,#dc2626_10%,var(--surface))] border border-[color-mix(in_srgb,#dc2626_22%,var(--border))]'
  const predictionLabel = heroAdvantages >= 3 ? 'Favorable' : heroAdvantages >= 2 ? 'Ajustado' : 'Difícil'

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Torre de Desafíos</h2>
        <p className="section-subtitle">Escala la torre para medir el poder de tu héroe. Cada piso es más difícil que el anterior.</p>
      </div>

      <ProgressStrip maxFloor={maxFloor} />

      {result && (
        <CombatReplay
          heroName={hero?.name ?? 'Héroe'}
          enemyName={enemyName(result.floor)}
          heroMaxHp={result.heroMaxHp}
          enemyMaxHp={result.enemyMaxHp}
          log={result.log ?? []}
          won={result.won}
          rewards={result.rewards}
          knockedOut={result.knockedOut}
          onClose={() => setResult(null)}
        />
      )}

      {/* Battle panel */}
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3.5 shadow-[var(--shadow-sm)]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[13px] font-bold text-text bg-surface-2 border border-border rounded-full px-2.5 py-1">
            <ChevronUp size={13} strokeWidth={2.5} />
            Piso {targetFloor}
          </div>
          <div className="flex items-center gap-1.5">
            {rewards.milestone && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#d97706] bg-[color-mix(in_srgb,#d97706_12%,var(--surface))] border border-[color-mix(in_srgb,#d97706_30%,var(--border))] px-2 py-0.5 rounded-full">
                <Star size={10} strokeWidth={2} /> Hito
              </span>
            )}
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full tracking-[0.03em] ${predictionClass}`}>
              {predictionLabel}
            </span>
          </div>
        </div>

        {/* Combatants */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-border">
          <span className="text-[14px] font-bold text-[var(--blue-600)] text-left">{hero?.name ?? '—'}</span>
          <span className="text-[11px] font-extrabold text-text-3 tracking-[0.08em] text-center">VS</span>
          <span className="text-[14px] font-bold text-[#dc2626] text-right">{enemyName(targetFloor)}</span>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-1">
          {HERO_STATS.map(s => <StatCompareRow key={s.label} {...s} />)}
        </div>
        <p className="text-[11px] text-text-3 -mt-0.5">HP actual · stats con equipo y cartas incluidos</p>

        {/* Advertencia KO asegurado */}
        {guaranteedKo && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,#dc2626_10%,var(--surface))] border border-[color-mix(in_srgb,#dc2626_30%,var(--border))]">
            <span className="text-[15px] leading-none">⚠️</span>
            <p className="text-[12px] font-semibold text-[#dc2626]">
              Tu HP no aguantará este combate. Espera a regenerar o asume la derrota.
            </p>
          </div>
        )}

        {/* Rewards preview */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-text-2">
            <Coins size={13} color="#d97706" strokeWidth={2} />{rewards.gold} oro
          </span>
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-text-2">
            <Star size={13} color="#0369a1" strokeWidth={2} />{rewards.experience} XP
          </span>
          {rewards.milestone && (
            <span className="ml-auto text-[11px] font-bold text-[#d97706]">×2 recompensas</span>
          )}
        </div>

        <motion.button
          className="btn btn--primary btn--lg btn--full"
          onClick={() => { setResult(null); attemptMutation.mutate() }}
          disabled={attemptMutation.isPending || isBusy || !hasEnoughHp}
          whileTap={attemptMutation.isPending || isBusy || !hasEnoughHp ? {} : { scale: 0.96 }}
          whileHover={attemptMutation.isPending || isBusy || !hasEnoughHp ? {} : { scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Swords size={16} strokeWidth={2} />
          {attemptMutation.isPending ? 'Combatiendo...' : isBusy ? 'Héroe ocupado' : !hasEnoughHp ? 'HP insuficiente' : `Intentar piso ${targetFloor}`}
        </motion.button>
      </div>
    </div>
  )
}
