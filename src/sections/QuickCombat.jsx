import { useState, useEffect, useReducer, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useHeroCards } from '../hooks/useHeroCards'
import { usePotions } from '../hooks/usePotions'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { trainingRewards } from '../lib/gameFormulas'
import { Swords, Heart, Coins, Star, Loader, Shield, Zap, Flame } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import { PotionPanel } from '../components/PotionPanel'

/* ─── Matchmaking animation (solo C. Rápido y futuro PvP) ────────────────────── */

const SEARCH_MESSAGES = [
  'Buscando oponente',
  'Rastreando señales de combate',
  'Analizando desafiantes',
  'Detectando presencia hostil',
  'Localizando objetivo',
]

const PREPARE_MESSAGES = [
  'Oponente encontrado',
  'Desafiante localizado',
  'Rival detectado',
]

function MatchmakingOverlay({ enemyName, onReady }) {
  const [phase, setPhase] = useState('search')   // search → found → countdown
  const [dots, setDots]   = useState('')
  const [count, setCount] = useState(3)
  const [searchMsg] = useState(() => SEARCH_MESSAGES[Math.floor(Math.random() * SEARCH_MESSAGES.length)])
  const [prepareMsg] = useState(() => PREPARE_MESSAGES[Math.floor(Math.random() * PREPARE_MESSAGES.length)])
  const searchDuration = useRef(2500 + Math.random() * 1500) // 2.5-4s

  useEffect(() => {
    if (phase !== 'search') return
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('found'), searchDuration.current)
    const t2 = setTimeout(() => setPhase('countdown'), searchDuration.current + 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count <= 0) { onReady(); return }
    const id = setTimeout(() => setCount(c => c - 1), 700)
    return () => clearTimeout(id)
  }, [phase, count, onReady])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex flex-col items-center justify-center gap-5 bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-lg px-10 py-14"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <AnimatePresence mode="wait">
          {phase === 'search' && (
            <motion.div
              key="search"
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#06b6d4] animate-ping opacity-30" />
                <div className="absolute inset-2 rounded-full border-2 border-[#06b6d4] animate-ping opacity-20" style={{ animationDelay: '0.3s' }} />
                <Swords size={32} className="text-[#06b6d4] relative z-10" strokeWidth={1.8} />
              </div>
              <p className="text-text text-[18px] font-bold tracking-wide">
                {searchMsg}{dots}
              </p>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]"
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'found' && (
            <motion.div
              key="found"
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-20 h-20 rounded-full bg-[#dc2626]/20 border-2 border-[#dc2626] flex items-center justify-center"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              >
                <Flame size={32} className="text-[#dc2626]" strokeWidth={1.8} />
              </motion.div>
              <div className="text-center">
                <p className="text-[#fbbf24] text-[14px] font-bold uppercase tracking-[0.15em] mb-1">
                  {prepareMsg}
                </p>
                <motion.p
                  className="text-text text-[24px] font-extrabold"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  {enemyName}
                </motion.p>
              </div>
            </motion.div>
          )}

          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <Shield size={28} className="text-[#3b82f6] mb-1" strokeWidth={1.8} />
                  <span className="text-[#93c5fd] text-[11px] font-bold uppercase tracking-wider">Tú</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={count}
                    className="text-[56px] font-black text-text leading-none"
                    initial={{ opacity: 0, scale: 2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.3 }}
                  >
                    {count > 0 ? count : '⚔️'}
                  </motion.span>
                </AnimatePresence>
                <div className="flex flex-col items-center">
                  <Flame size={28} className="text-[#dc2626] mb-1" strokeWidth={1.8} />
                  <span className="text-[#fca5a5] text-[11px] font-bold uppercase tracking-wider">Rival</span>
                </div>
              </div>
              <p className="text-text-3 text-[13px] font-semibold">Preparando combate...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function QuickCombat() {
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const heroId               = useHeroId()
  const queryClient          = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { items }  = useInventory(hero?.id)
  const { cards }  = useHeroCards(hero?.id)
  const { potions }  = usePotions(userId)
  const [matchmaking, setMatchmaking] = useState(false)
  const [pendingResult, setPendingResult] = useState(null)
  const [result, setResult] = useState(null)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  const hpPotions = (potions ?? []).filter(p => p.effect_type === 'hp_restore' && p.quantity > 0)
  const potionMutation = useMutation({
    mutationFn: async (potionId) => {
      await apiPost('/api/potion-use', { heroId: hero?.id, potionId })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.potions(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.hero(heroId) }),
      ])
    },
    onSuccess: () => toast.success('¡Poción usada!'),
    onError: err => toast.error(err.message),
  })

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

  const nowMs = Date.now()

  // Equip bonuses (same pattern as Torre)
  const equipBonuses = (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .reduce((acc, i) => {
      const c = i.item_catalog
      acc.attack   += c.attack_bonus   ?? 0
      acc.defense  += c.defense_bonus  ?? 0
      acc.max_hp   += c.hp_bonus       ?? 0
      acc.strength += c.strength_bonus ?? 0
      acc.agility  += c.agility_bonus  ?? 0
      ;(i.item_runes ?? []).forEach(ir => {
        ;(ir.rune_catalog?.bonuses ?? []).forEach(({ stat, value }) => {
          if (stat in acc) acc[stat] += value
        })
      })
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

  const effectiveMaxHp = hero
    ? hero.max_hp + equipBonuses.max_hp + (cardBonuses.max_hp ?? 0)
    : 100
  const hpNow       = interpolateHp(hero, nowMs, effectiveMaxHp)
  const minHp       = Math.floor(effectiveMaxHp * 0.2)
  const hasEnoughHp = hpNow >= minHp
  const isBusy      = hero?.status !== 'idle'

  const rewards = trainingRewards(hero?.level ?? 1)

  const combatMutation = useMutation({
    mutationFn: () => apiPost('/api/quick-combat', { heroId: hero?.id }),
    onSuccess: (data) => {
      // Store result but don't show yet — matchmaking animation handles reveal
      setPendingResult(data)
    },
    onError: (err) => {
      setMatchmaking(false)
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
  })

  function startCombat() {
    setResult(null)
    setPendingResult(null)
    setMatchmaking(true)
    combatMutation.mutate()
  }



  // If matchmaking finished but API was slow, show result once ready
  const [waitingForApi, setWaitingForApi] = useState(false)
  function revealResult(data) {
    setMatchmaking(false)
    setResult(data)
    setPendingResult(null)
    setWaitingForApi(false)
    if (data.won) triggerResourceFlash()
    // Refrescar HP y recursos solo al revelar el resultado, no antes
    queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
  }

  useEffect(() => {
    if (waitingForApi && pendingResult) revealResult(pendingResult)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForApi, pendingResult])

  const handleAnimationDone = useCallback(() => {
    if (pendingResult) {
      revealResult(pendingResult)
    } else {
      // API still loading — wait
      setWaitingForApi(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingResult])

  if (heroLoading) return <div className="text-text-3 text-[14px] p-10 text-center">Cargando...</div>

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Combate Rápido</h2>
        <p className="section-subtitle">Enfréntate a rivales aleatorios para probar tu héroe. Recompensas modestas, sin desgaste de equipo.</p>
      </div>

      {/* Matchmaking overlay */}
      <AnimatePresence>
        {matchmaking && (
          <MatchmakingOverlay
            enemyName={pendingResult?.enemyName ?? '???'}
            onReady={handleAnimationDone}
          />
        )}
      </AnimatePresence>

      {/* Combat replay */}
      {result && (
        <CombatReplay
          heroName={hero?.name ?? 'Héroe'}
          enemyName={result.enemyName}
          heroMaxHp={result.heroMaxHp}
          enemyMaxHp={result.enemyMaxHp}
          log={result.log ?? []}
          won={result.won}
          rewards={result.rewards}
          onClose={() => setResult(null)}
        />
      )}

      {/* Battle panel */}
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 shadow-[var(--shadow-sm)]">

        {/* Info */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Combate rápido</span>
            <span className="text-[15px] font-bold text-text leading-tight">Rival aleatorio · Nv.{hero?.level ?? 1}</span>
          </div>
        </div>

        {/* Estimated rewards */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3 mr-auto">Recompensa</span>
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
            <Coins size={13} color="#d97706" strokeWidth={2} />+{rewards.gold} oro
          </span>
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
            <Star size={13} color="#0369a1" strokeWidth={2} />+{rewards.experience} XP
          </span>
        </div>

        {/* Perks */}
        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] font-semibold text-[#16a34a] bg-[color-mix(in_srgb,#16a34a_10%,var(--surface-2))] border border-[color-mix(in_srgb,#16a34a_25%,var(--border))] px-2 py-1 rounded-md">
            Sin desgaste de equipo
          </span>
          <span className="text-[11px] font-semibold text-[#d97706] bg-[color-mix(in_srgb,#d97706_10%,var(--surface-2))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] px-2 py-1 rounded-md">
            HP se consume
          </span>
        </div>

        {/* HP bar + heal potions */}
        {hero && (() => {
          const pct   = Math.min(100, Math.round((hpNow / effectiveMaxHp) * 100))
          const color = hero.status === 'idle' ? '#0369a1' : pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
          const recovering = hero.status === 'idle'
          const full = hpNow >= effectiveMaxHp
          return (
            <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
              <div className="flex justify-between items-center text-[13px] font-semibold text-text-2">
                <span className="flex items-center gap-[5px]"><Heart size={13} strokeWidth={2} color={color} /> HP</span>
                <span className="font-medium" style={{ color }}>{hpNow} / {effectiveMaxHp}</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width,background] duration-[400ms]${recovering ? ' animate-hp-regen-pulse' : ''}`}
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              {hpPotions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {hpPotions.map(p => {
                    const disabled = full || isBusy || potionMutation.isPending
                    return (
                      <motion.button
                        key={p.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-[opacity] duration-150 disabled:opacity-40"
                        style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface)' }}
                        onClick={() => !disabled && potionMutation.mutate(p.id)}
                        disabled={disabled}
                        whileTap={disabled ? {} : { scale: 0.95 }}
                      >
                        <Heart size={11} strokeWidth={2.5} style={{ color: '#16a34a' }} />
                        {p.name}
                        <span className="opacity-60">×{p.quantity}</span>
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}

        <PotionPanel heroId={heroId} userId={userId} activeEffects={hero?.active_effects ?? {}} />

        <motion.button
          className="btn btn--primary btn--lg btn--full"
          onClick={startCombat}
          disabled={combatMutation.isPending || matchmaking || isBusy || !hasEnoughHp}
          whileTap={combatMutation.isPending || matchmaking || isBusy || !hasEnoughHp ? {} : { scale: 0.96 }}
          whileHover={combatMutation.isPending || matchmaking || isBusy || !hasEnoughHp ? {} : { scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Swords size={16} strokeWidth={2} />
          {combatMutation.isPending || matchmaking
            ? 'Buscando rival...'
            : isBusy
              ? 'Héroe ocupado'
              : !hasEnoughHp
                ? 'HP insuficiente (20% mín.)'
                : 'Buscar combate'}
        </motion.button>
      </div>
    </div>
  )
}
