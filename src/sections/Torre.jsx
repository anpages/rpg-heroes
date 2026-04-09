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
import { floorEnemyStats, floorRewards, floorEnemyName } from '../lib/gameFormulas'
import { Swords, Star, Coins, Trophy, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import { PotionPanel } from '../components/PotionPanel'
import { showItemDropToast } from '../lib/dropToast'

const MILESTONES = [5, 10, 25, 50, 100]
// Posición % de cada milestone en la barra (relativa al máximo = 100)
const MILESTONE_PCT = [5, 10, 25, 50, 100]


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

/* ─── Threat indicator ───────────────────────────────────────────────────────── */

const THREAT_META = [
  { label: 'Débil',      color: '#16a34a', dots: 1 },
  { label: 'Moderado',   color: '#65a30d', dots: 2 },
  { label: 'Equilibrado',color: '#d97706', dots: 3 },
  { label: 'Peligroso',  color: '#ea580c', dots: 4 },
  { label: 'Letal',      color: '#dc2626', dots: 5 },
]

function threatLevel(hero, enemy) {
  if (!hero || !enemy) return 3
  const heroScore  = hero.attack + hero.defense + hero.max_hp * 0.04 + hero.strength * 0.5 + hero.agility * 0.3
  const enemyScore = enemy.attack + enemy.defense + enemy.max_hp * 0.04 + enemy.strength * 0.5 + enemy.agility * 0.3
  const ratio = enemyScore / Math.max(1, heroScore)
  if (ratio < 0.7)  return 1
  if (ratio < 0.9)  return 2
  if (ratio < 1.15) return 3
  if (ratio < 1.4)  return 4
  return 5
}

function ThreatIndicator({ level }) {
  const meta = THREAT_META[level - 1] ?? THREAT_META[2]
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-sm transition-colors"
            style={{ background: i < meta.dots ? meta.color : 'var(--border)' }}
          />
        ))}
      </div>
      <span className="text-[13px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────────── */


export default function Torre() {
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const heroId               = useHeroId()
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
    .filter(c => c.slot_index !== null && c.slot_index !== undefined)
    .reduce((acc, c) => {
      const sc   = c.skill_cards
      const rank = Math.min(c.rank, 5)
      ;(sc.bonuses   ?? []).forEach(({ stat, value }) => { if (stat in acc) acc[stat] += Math.round(value * rank) })
      ;(sc.penalties ?? []).forEach(({ stat, value }) => { if (stat in acc) acc[stat] -= Math.round(value * (1 + (rank - 1) * 0.5)) })
      return acc
    }, { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0, intelligence: 0 })

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
  const threat      = threatLevel(effectiveHero, enemy)

  const attemptMutation = useMutation({
    mutationFn: () => apiPost('/api/tower-attempt', { heroId: hero?.id }),
    onSuccess: (data) => {
      if (data.rewards?.drop?.item_catalog) showItemDropToast(data.rewards.drop.item_catalog)
      setResult(data)
      if (data.won) {
        triggerResourceFlash()
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
          enemyName={floorEnemyName(result.floor)}
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
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 shadow-[var(--shadow-sm)]">

        {/* Floor + milestone */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[13px] font-bold text-text bg-surface-2 border border-border rounded-full px-2.5 py-1">
            <ChevronUp size={13} strokeWidth={2.5} />
            Piso {targetFloor}
          </div>
          {rewards.milestone && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-[#d97706] bg-[color-mix(in_srgb,#d97706_12%,var(--surface))] border border-[color-mix(in_srgb,#d97706_30%,var(--border))] px-2 py-0.5 rounded-full">
              <Star size={10} strokeWidth={2} /> Hito — recompensa ×2
            </span>
          )}
        </div>

        {/* Enemy */}
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Enemigo</span>
            <span className="text-[22px] font-extrabold text-[#ef4444] leading-none">{floorEnemyName(targetFloor)}</span>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Nivel de amenaza</span>
            <ThreatIndicator level={threat} />
          </div>
        </div>

        {/* Rewards */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-text-2">
            <Coins size={13} color="#d97706" strokeWidth={2} />{rewards.gold} oro
          </span>
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-text-2">
            <Star size={13} color="#0369a1" strokeWidth={2} />{rewards.experience} XP
          </span>
        </div>

        <PotionPanel heroId={heroId} activeEffects={hero?.active_effects ?? {}} />

        <motion.button
          className="btn btn--primary btn--lg btn--full"
          onClick={() => { setResult(null); attemptMutation.mutate() }}
          disabled={attemptMutation.isPending || isBusy || !hasEnoughHp}
          whileTap={attemptMutation.isPending || isBusy || !hasEnoughHp ? {} : { scale: 0.96 }}
          whileHover={attemptMutation.isPending || isBusy || !hasEnoughHp ? {} : { scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Swords size={16} strokeWidth={2} />
          {attemptMutation.isPending ? 'Combatiendo...' : isBusy ? 'Héroe ocupado' : !hasEnoughHp ? 'HP insuficiente (20% mín.)' : `Combatir piso ${targetFloor}`}
        </motion.button>
      </div>
    </div>
  )
}
