import { useState, useEffect, useReducer, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { useHeroTactics } from '../hooks/useHeroTactics'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { trainingRewards } from '../lib/gameFormulas'
import { COMBAT_STRATEGIES } from '../lib/gameConstants'
import { Swords, Coins, Star, Shield, Flame, Layers, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import { tierForRating } from '../lib/combatRating'
import { PotionPanel } from '../components/PotionPanel'
import { HeroCombatPicker } from '../components/HeroPicker'

/* ─── Matchmaking overlay (buscar → 3 2 1) ───────────────────────────────────── */

const SEARCH_MESSAGES = [
  'Buscando rival',
  'Analizando oponentes',
  'Localizando objetivo',
  'Detectando desafiante',
]

function MatchmakingOverlay({ rivalFound, onReady }) {
  const [phase, setPhase]   = useState('search')   // 'search' | 'countdown'
  const [count, setCount]   = useState(3)
  const [dots, setDots]     = useState('')
  const [msgIdx, setMsgIdx] = useState(0)

  // Puntos animados
  useEffect(() => {
    if (phase !== 'search') return
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(id)
  }, [phase])

  // Ciclar mensajes
  useEffect(() => {
    if (phase !== 'search') return
    const id = setInterval(() => setMsgIdx(i => (i + 1) % SEARCH_MESSAGES.length), 1800)
    return () => clearInterval(id)
  }, [phase])

  // Cuando llega el rival, pasar a countdown
  useEffect(() => {
    if (rivalFound && phase === 'search') setPhase('countdown')
  }, [rivalFound, phase])

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return
    if (count <= 0) { onReady(); return }
    const id = setTimeout(() => setCount(c => c - 1), 700)
    return () => clearTimeout(id)
  }, [phase, count, onReady])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex flex-col items-center justify-center bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-[300px] h-[220px]"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <AnimatePresence mode="wait">
          {phase === 'search' && (
            <motion.div
              key="search"
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#06b6d4]/35 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-[#06b6d4]/22 animate-ping" style={{ animationDelay: '0.35s' }} />
                <Swords size={24} className="text-[#06b6d4] relative z-10" strokeWidth={1.8} />
              </div>
              <p className="text-[15px] font-bold text-text">
                {SEARCH_MESSAGES[msgIdx]}{dots}
              </p>
            </motion.div>
          )}

          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-1">
                  <Shield size={28} className="text-[#3b82f6]" strokeWidth={1.8} />
                  <span className="text-[11px] font-bold text-[#93c5fd] uppercase tracking-wider">Tú</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={count}
                    className="text-[64px] font-black text-text leading-none"
                    initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.28 }}
                  >
                    {count > 0 ? count : '⚔️'}
                  </motion.span>
                </AnimatePresence>
                <div className="flex flex-col items-center gap-1">
                  <Flame size={28} className="text-[#dc2626]" strokeWidth={1.8} />
                  <span className="text-[11px] font-bold text-[#fca5a5] uppercase tracking-wider">Rival</span>
                </div>
              </div>
              <p className="text-text-3 text-[13px] font-semibold">¡Rival encontrado!</p>
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
  const [heroId, setHeroId]  = useState(null)
  const queryClient          = useQueryClient()
  const { hero }             = useHero(heroId)
  const { items }            = useInventory(heroId)
  const { tactics }          = useHeroTactics(heroId)
  const { catalog, inventory } = useCraftedItems(userId)
  const [matchmaking, setMatchmaking]     = useState(false)
  const [rivalFound, setRivalFound]       = useState(false)
  const [pendingResult, setPendingResult] = useState(null)
  const [result, setResult]               = useState(null)
  const [waitingForApi, setWaitingForApi] = useState(false)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 1000)
    return () => clearInterval(id)
  }, [])

  const nowMs          = Date.now()
  const effectiveMaxHp = hero ? hero.max_hp + (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .reduce((s, i) => s + (i.item_catalog.hp_bonus ?? 0), 0) : 100
  const hpNow       = interpolateHp(hero, nowMs, effectiveMaxHp)
  const hasEnoughHp = hpNow >= Math.floor(effectiveMaxHp * 0.2)
  const isBusy      = hero?.status !== 'idle'
  const rewards     = trainingRewards(hero?.level ?? 1)

  const hpPotions = (catalog ?? [])
    .filter(c => c.effects?.some(e => e.type === 'hp_restore') && (inventory[c.id] ?? 0) > 0)
    .map(c => ({ ...c, quantity: inventory[c.id] ?? 0 }))

  const itemUseMutation = useMutation({
    mutationFn: async (recipeId) => {
      await apiPost('/api/item-use', { heroId: hero?.id, recipeId })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.craftedItems(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.hero(heroId) }),
      ])
    },
    onError: err => notify.error(err.message),
  })

  // Al pulsar "Combatir": busca rival y lucha en una sola acción
  const combatMutation = useMutation({
    mutationFn: async () => {
      const preview = await apiPost('/api/quick-combat-preview', {})
      return apiPost('/api/quick-combat', { heroId, previewToken: preview.token })
    },
    onSuccess:  (data) => { setPendingResult(data); setRivalFound(true) },
    onError: (err) => {
      setMatchmaking(false)
      setRivalFound(false)
      notify.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
  })

  function startCombat() {
    setPendingResult(null)
    setRivalFound(false)
    setMatchmaking(true)
    combatMutation.mutate()
  }

  function revealResult(data) {
    setMatchmaking(false)
    setRivalFound(false)
    setResult(data)
    setPendingResult(null)
    setWaitingForApi(false)
  }

  function applyPostCombat(data) {
    if (!data) return
    if (data.won) {
      triggerResourceFlash()
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    if (data.durabilityLoss > 0) queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
  }

  useEffect(() => {
    if (waitingForApi && pendingResult) revealResult(pendingResult)
  }, [waitingForApi, pendingResult])

  const handleAnimationDone = useCallback(() => {
    if (pendingResult) revealResult(pendingResult)
    else setWaitingForApi(true)
  }, [pendingResult])

  const tier = tierForRating(hero?.combat_rating ?? 0)

  const activeExtras = heroId && hero ? (() => {
    const equipped = (items ?? []).filter(i => i.equipped_slot != null && (i.item_catalog?.max_durability ?? 0) > 0)
    const durPct   = equipped.length
      ? Math.round(equipped.reduce((s, i) => s + i.current_durability / i.item_catalog.max_durability, 0) / equipped.length * 100)
      : null
    const equippedTactics = (tactics ?? []).filter(t => t.slot_index != null && t.tactic_catalog)
    return { durPct, equippedTactics, tier }
  })() : null

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Combate Rápido</h2>
        <p className="section-subtitle">Elige tu héroe y combate.</p>
      </div>

      <AnimatePresence>
        {matchmaking && <MatchmakingOverlay rivalFound={rivalFound} onReady={handleAnimationDone} />}
      </AnimatePresence>

      {result && (
        <CombatReplay
          heroName={hero?.name ?? 'Héroe'}
          enemyName={result.enemyName}
          heroMaxHp={result.heroMaxHp}
          enemyMaxHp={result.enemyMaxHp}
          log={result.log ?? []}
          won={result.won}
          rewards={result.rewards}
          rating={result.rating}
          heroClass={result.heroClass}
          archetype={result.archetype}
          enemyTactics={result.enemyTactics}
          onClose={() => { applyPostCombat(result); setResult(null) }}
        />
      )}

      {/* Recompensas */}
      <div className="bg-surface border border-border rounded-xl px-5 py-4 flex flex-col gap-2 shadow-[var(--shadow-sm)]">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Recompensas al ganar</span>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
            <Coins size={13} color="#d97706" strokeWidth={2} />+{rewards.gold} oro
          </span>
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
            <Star size={13} color="#0369a1" strokeWidth={2} />+{rewards.experience} XP
          </span>
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#7c3aed]">
            <Layers size={13} color="#7c3aed" strokeWidth={2} />Táctica (8%)
          </span>
        </div>
      </div>

      {/* Héroe */}
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 shadow-[var(--shadow-sm)]">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">
          {heroId ? 'Tu héroe' : 'Elige tu héroe'}
        </span>

        <HeroCombatPicker activeId={heroId} onSelect={setHeroId} activeExtras={activeExtras} />

        {!heroId && (
          <p className="text-[13px] text-text-3 text-center py-1">
            Selecciona el héroe que enviará a combatir
          </p>
        )}

        {heroId && hero?.combat_strategy && (() => {
          const s = COMBAT_STRATEGIES[hero.combat_strategy]
          return s ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-lg">
              <span className="text-[15px] leading-none">{s.icon}</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-text-3">Estrategia defensiva</span>
                <span className="text-[12px] font-semibold text-text-2">{s.label} — {s.description}</span>
              </div>
            </div>
          ) : null
        })()}

        {heroId && hero && (() => {
          const pct      = Math.min(100, Math.round((hpNow / effectiveMaxHp) * 100))
          const hpColor  = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
          const full     = hpNow >= effectiveMaxHp
          const equipped = (items ?? []).filter(i => i.equipped_slot != null && (i.item_catalog?.max_durability ?? 0) > 0)
          const durPct   = equipped.length
            ? Math.round(equipped.reduce((s, i) => s + (i.current_durability / i.item_catalog.max_durability), 0) / equipped.length * 100)
            : null
          const durColor = durPct == null ? '#6b7280' : durPct > 60 ? '#16a34a' : durPct > 30 ? '#d97706' : '#dc2626'
          return (
            <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
              <div className="flex justify-between items-center text-[13px] font-semibold text-text-2">
                <span className="flex items-center gap-[5px]"><Heart size={13} strokeWidth={2} color={hpColor} /> HP</span>
                <span className="font-medium" style={{ color: hpColor }}>{hpNow} / {effectiveMaxHp}</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width,background] duration-[400ms] animate-hp-regen-pulse"
                  style={{ width: `${pct}%`, background: hpColor }}
                />
              </div>
              {durPct != null && (
                <>
                  <div className="flex justify-between items-center text-[13px] font-semibold text-text-2 mt-1">
                    <span className="flex items-center gap-[5px]"><Shield size={13} strokeWidth={2} color={durColor} /> Equipo</span>
                    <span className="font-medium" style={{ color: durColor }}>{durPct}%</span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width,background] duration-[400ms]"
                      style={{ width: `${durPct}%`, background: durColor }}
                    />
                  </div>
                </>
              )}
              {hpPotions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {hpPotions.map(p => {
                    const disabled = full || isBusy || itemUseMutation.isPending
                    return (
                      <motion.button
                        key={p.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-[opacity] duration-150 disabled:opacity-40"
                        style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface)' }}
                        onClick={() => !disabled && itemUseMutation.mutate(p.id)}
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

        {heroId && (
          <PotionPanel heroId={heroId} userId={userId} activeEffects={hero?.active_effects ?? {}} title="Pociones de combate" />
        )}

        {heroId && (
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
              : hero?.status === 'training'
                ? 'Entrenando'
                : isBusy
                ? 'En expedición'
                : !hasEnoughHp
                  ? 'HP insuficiente (20% mín.)'
                  : '¡Combatir!'}
          </motion.button>
        )}
      </div>
    </div>
  )
}
