import { useState, useEffect, useReducer, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHero } from '../hooks/useHero'
import { useHeroes } from '../hooks/useHeroes'
import { useInventory } from '../hooks/useInventory'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { useHeroTactics } from '../hooks/useHeroTactics'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { trainingRewards } from '../lib/gameFormulas'
import { Swords, Coins, Star, Shield, Flame, Layers, ChevronRight } from 'lucide-react'
import { CLASS_LABELS, CLASS_ICONS, CLASS_COLORS } from '../lib/gameConstants'
import { motion, AnimatePresence } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import { tierForRating, pointsToNextTier, TIERS } from '../lib/combatRating'
import { PotionPanel } from '../components/PotionPanel'
import { HeroCombatPicker } from '../components/HeroPicker'

/* ─── Mensajes de búsqueda ───────────────────────────────────────────────────── */

const SEARCH_MESSAGES = [
  'Conectando con la arena',
  'Analizando rivales disponibles',
  'Calculando nivel de combate',
  'Localizando oponente',
  'Evaluando desafiantes',
  'Escaneando la clasificación',
]

/* ─── Countdown overlay ──────────────────────────────────────────────────────── */

function CountdownOverlay({ onReady }) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count <= 0) { onReady(); return }
    const id = setTimeout(() => setCount(c => c - 1), 700)
    return () => clearTimeout(id)
  }, [count, onReady])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex flex-col items-center gap-6 bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] px-14 py-12"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
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
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
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
        <p className="text-text-3 text-[13px] font-semibold">Preparando combate...</p>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Fase: buscando rival ───────────────────────────────────────────────────── */

function SearchingCard() {
  const [msgIdx, setMsgIdx]     = useState(0)
  const [dots, setDots]         = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % SEARCH_MESSAGES.length), 2200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setProgress(p => Math.min(88, p + Math.random() * 7 + 1.5)), 280)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-10">
      {/* Radar */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-[#06b6d4]/35 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-[#06b6d4]/22 animate-ping" style={{ animationDelay: '0.35s' }} />
        <div className="absolute inset-4 rounded-full border-2 border-[#06b6d4]/14 animate-ping" style={{ animationDelay: '0.7s' }} />
        <div className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, #06b6d4 10%, var(--surface-2))', border: '1.5px solid color-mix(in srgb, #06b6d4 30%, var(--border))' }}>
          <Swords size={20} className="text-[#06b6d4]" strokeWidth={1.8} />
        </div>
      </div>

      {/* Mensaje ciclado */}
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            className="text-[15px] font-bold text-text"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.18 }}
          >
            {SEARCH_MESSAGES[msgIdx]}{dots}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Barra de progreso */}
      <div className="w-full max-w-[220px]">
        <div className="h-[3px] bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: '#06b6d4' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Fase: rival encontrado (reveal dramático) ──────────────────────────────── */

function RivalRevealCard({ preview, enemyClass, classColor, tier, onAccept, onChange }) {
  return (
    <motion.div
      className="flex flex-col overflow-hidden rounded-xl border border-border shadow-[var(--shadow-sm)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {/* Banner */}
      <div className="px-4 py-2 flex items-center justify-center gap-2"
        style={{ background: 'color-mix(in srgb, #dc2626 8%, var(--surface-2))', borderBottom: '1px solid color-mix(in srgb, #dc2626 18%, var(--border))' }}>
        <motion.span
          className="text-[11px] font-black uppercase tracking-[0.18em]"
          style={{ color: '#fbbf24' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        >
          ⚔ &nbsp;Rival encontrado&nbsp; ⚔
        </motion.span>
      </div>

      {/* Contenido */}
      <div className="flex flex-col items-center gap-5 px-6 py-8 bg-surface">
        {/* Icono de clase */}
        <motion.div
          className="rounded-2xl flex items-center justify-center text-[44px] leading-none"
          style={{
            width: 88, height: 88,
            background: `color-mix(in srgb, ${classColor} 14%, var(--surface-2))`,
            border: `2px solid color-mix(in srgb, ${classColor} 40%, var(--border))`,
            boxShadow: `0 0 28px color-mix(in srgb, ${classColor} 18%, transparent)`,
          }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 320, damping: 18 }}
        >
          {enemyClass ? CLASS_ICONS[enemyClass] : <Flame size={36} strokeWidth={1.5} style={{ color: classColor }} />}
        </motion.div>

        {/* Nombre + badges */}
        <motion.div
          className="text-center flex flex-col gap-2.5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.22 }}
        >
          <p className="text-[24px] font-black text-text tracking-tight leading-tight">{preview.enemyName}</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {enemyClass && (
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-lg"
                style={{
                  color: classColor,
                  background: `color-mix(in srgb, ${classColor} 12%, var(--surface))`,
                  border: `1px solid color-mix(in srgb, ${classColor} 30%, var(--border))`,
                }}>
                {CLASS_LABELS[enemyClass]}
              </span>
            )}
            <span className="text-[12px] font-bold px-2.5 py-1 rounded-lg"
              style={{
                color: tier.color,
                background: `color-mix(in srgb, ${tier.color} 12%, var(--surface))`,
                border: `1px solid color-mix(in srgb, ${tier.color} 25%, var(--border))`,
              }}>
              {tier.label}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Acciones */}
      <div className="px-4 pb-5 pt-1 flex flex-col gap-2 bg-surface">
        <motion.button
          className="btn btn--primary btn--lg btn--full"
          onClick={onAccept}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.2 }}
          whileTap={{ scale: 0.97 }}
        >
          Elegir héroe <ChevronRight size={16} strokeWidth={2.5} />
        </motion.button>
        <motion.button
          className="text-[12px] font-semibold text-text-3 text-center py-1.5 bg-transparent border-none font-[inherit] cursor-pointer"
          onClick={onChange}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.36, duration: 0.2 }}
        >
          Buscar otro rival
        </motion.button>
      </div>
    </motion.div>
  )
}

/* ─── Pantalla de resultados ─────────────────────────────────────────────────── */

function CombatResultScreen({ result, heroName, onContinue }) {
  const { won, rating, rewards, enemyName } = result
  const prevTier  = tierForRating(rating.prev)
  const afterTier = tierForRating(rating.current)
  const promoted  = rating.promoted
  const delta     = rating.delta

  const tierIdx  = TIERS.findIndex(t => rating.current >= t.min)
  const nextMin  = tierIdx > 0 ? TIERS[tierIdx - 1].min : null
  const tierPct  = nextMin
    ? Math.min(100, Math.round(((rating.current - afterTier.min) / (nextMin - afterTier.min)) * 100))
    : 100
  const ptsLeft = pointsToNextTier(rating.current)

  return (
    <motion.div
      className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Cabecera victoria / derrota */}
      <div
        className="px-5 py-5 flex flex-col items-center gap-1 text-center"
        style={won
          ? { background: 'color-mix(in srgb, #16a34a 10%, var(--surface-2))' }
          : { background: 'color-mix(in srgb, #dc2626 10%, var(--surface-2))' }
        }
      >
        <span className="text-[36px] leading-none">{won ? '🏆' : '💀'}</span>
        <p className="text-[20px] font-black text-text mt-1">{won ? '¡Victoria!' : 'Derrota'}</p>
        <p className="text-[12px] text-text-3">{heroName} <span className="opacity-50">vs</span> {enemyName}</p>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {/* Recompensas */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Recompensas</span>
          {won && rewards ? (
            <div className="flex flex-wrap gap-3">
              <span className="flex items-center gap-1.5 text-[14px] font-bold text-text">
                <Coins size={15} color="#d97706" strokeWidth={2} />+{rewards.gold} oro
              </span>
              <span className="flex items-center gap-1.5 text-[14px] font-bold text-text">
                <Star size={15} color="#0369a1" strokeWidth={2} />+{rewards.experience} XP
              </span>
              {rewards.tacticDrop && (
                <span className="flex items-center gap-1.5 text-[13px] font-bold px-2.5 py-1 rounded-lg"
                  style={{ color: '#7c3aed', background: 'color-mix(in srgb, #7c3aed 10%, var(--surface-2))', border: '1px solid color-mix(in srgb, #7c3aed 25%, var(--border))' }}>
                  <span>{rewards.tacticDrop.icon}</span>
                  {rewards.tacticDrop.name}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-text-3">Sin recompensas esta vez.</p>
          )}
        </div>

        {/* Rating */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Rating</span>
            <span className="text-[13px] font-black tabular-nums" style={{ color: delta >= 0 ? '#16a34a' : '#dc2626' }}>
              {delta >= 0 ? `+${delta}` : delta}
            </span>
          </div>

          {/* Promoción de tier */}
          {promoted ? (
            <motion.div
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl"
              style={{ background: `color-mix(in srgb, ${afterTier.color} 10%, var(--surface-2))`, border: `1px solid color-mix(in srgb, ${afterTier.color} 28%, var(--border))` }}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12, type: 'spring', stiffness: 280, damping: 18 }}
            >
              <span className="text-[13px] font-bold" style={{ color: prevTier.color }}>{prevTier.label}</span>
              <ChevronRight size={14} strokeWidth={2.5} style={{ color: afterTier.color }} />
              <span className="text-[15px] font-black" style={{ color: afterTier.color }}>{afterTier.label}</span>
              <span className="text-[18px] leading-none ml-1">🎉</span>
            </motion.div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-text tabular-nums">{rating.prev} → {rating.current}</span>
              <span className="text-[12px] font-bold px-2 py-0.5 rounded"
                style={{ color: afterTier.color, background: `color-mix(in srgb, ${afterTier.color} 10%, var(--surface-2))`, border: `1px solid color-mix(in srgb, ${afterTier.color} 22%, var(--border))` }}>
                {afterTier.label}
              </span>
            </div>
          )}

          {/* Barra de progreso en el tier */}
          {nextMin && (
            <div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: afterTier.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${tierPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
              {ptsLeft != null && (
                <p className="text-[11px] text-text-3 mt-1 text-right tabular-nums">{ptsLeft} pts para {TIERS[tierIdx - 1].label}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botón */}
      <div className="px-5 pb-5 pt-1">
        <motion.button
          className="btn btn--primary btn--lg btn--full"
          onClick={onContinue}
          whileTap={{ scale: 0.97 }}
        >
          <Swords size={15} strokeWidth={2} /> Siguiente rival
        </motion.button>
      </div>
    </motion.div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function QuickCombat() {
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const [heroId, setHeroId]  = useState(null)
  const queryClient          = useQueryClient()
  const { heroes }           = useHeroes(userId)
  const { hero }             = useHero(heroId)
  const { items }            = useInventory(heroId)
  const { tactics }          = useHeroTactics(heroId)
  useCraftedItems(userId)

  // Fase visual: 'idle' | 'found' | 'selecting'
  const [phase, setPhase] = useState('idle')

  const [matchmaking, setMatchmaking]     = useState(false)
  const [pendingResult, setPendingResult] = useState(null)
  const [result, setResult]               = useState(null)
  const [postResult, setPostResult]       = useState(null)
  const [waitingForApi, setWaitingForApi] = useState(false)
  const [preview, setPreview]             = useState(null)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10_000)
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

  const previewMutation = useMutation({
    mutationFn: () => apiPost('/api/quick-combat-preview', {}),
    onSuccess: (data) => { setPreview(data); setPhase('found') },
    onError:   (err)  => notify.error(err.message),
  })

  const combatMutation = useMutation({
    mutationFn: () => apiPost('/api/quick-combat', { heroId, previewToken: preview?.token }),
    onSuccess:  (data) => setPendingResult(data),
    onError: (err) => {
      setMatchmaking(false)
      if (err.message.includes('INVALID_PREVIEW') || err.message.includes('Token')) {
        setPreview(null); setHeroId(null); setPhase('idle')
        notify.error('El rival ha expirado. Busca uno nuevo.')
      } else {
        notify.error(err.message)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
  })

  function resetSearch() {
    setPreview(null); setHeroId(null); setPhase('idle')
  }

  function startCombat() {
    setPendingResult(null); setMatchmaking(true); combatMutation.mutate()
  }

  function revealResult(data) {
    setMatchmaking(false); setResult(data); setPendingResult(null); setWaitingForApi(false)
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

  const enemyClass = preview?.enemyClass ?? null
  const tier       = tierForRating(hero?.combat_rating ?? 0)
  const enemyTier  = tierForRating(preview?.enemyRating ?? 0)
  const classColor = enemyClass ? (CLASS_COLORS[enemyClass] ?? '#6b7280') : enemyTier.color

  const activeExtras = heroId && hero ? (() => {
    const equipped = (items ?? []).filter(i => i.equipped_slot != null && (i.item_catalog?.max_durability ?? 0) > 0)
    const durPct   = equipped.length
      ? Math.round(equipped.reduce((s, i) => s + i.current_durability / i.item_catalog.max_durability, 0) / equipped.length * 100)
      : null
    const equippedTactics = (tactics ?? []).filter(t => t.slot_index != null && t.tactic_catalog)
    return { durPct, equippedTactics, tier }
  })() : null

  const anyHeroAvailable = (heroes ?? []).some(h => {
    const activeExp = h.expeditions?.find(e => e.status === 'traveling')
    if (activeExp && new Date(activeExp.ends_at) > new Date(nowMs)) return false
    return h.status === 'idle' || !!activeExp
  })

  const isSearching = previewMutation.isPending

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Combate Rápido</h2>
        <p className="section-subtitle">Encuentra un rival, elige tu héroe y combate.</p>
      </div>

      <AnimatePresence>
        {matchmaking && <CountdownOverlay onReady={handleAnimationDone} />}
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
          onClose={() => { applyPostCombat(result); setPostResult(result); setResult(null) }}
        />
      )}

      {/* ── Pantalla de resultados ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!result && postResult && (
          <motion.div key="post-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <CombatResultScreen
              result={postResult}
              heroName={hero?.name ?? 'Héroe'}
              onContinue={() => { setPostResult(null); resetSearch() }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Área principal: fases con transición ──────────────────────────── */}
      {!postResult && <AnimatePresence mode="wait">

        {/* IDLE */}
        {!isSearching && phase === 'idle' && (
          <motion.div
            key="idle"
            className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex flex-col items-center gap-5 px-6 py-10">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, #2563eb 10%, var(--surface-2))', border: '1.5px solid color-mix(in srgb, #2563eb 25%, var(--border))' }}>
                <Swords size={28} className="text-[#2563eb]" strokeWidth={1.6} />
              </div>
              <div className="text-center flex flex-col gap-1.5">
                <p className="text-[16px] font-bold text-text">¿Preparado para combatir?</p>
                <p className="text-[12px] text-text-3 flex items-center justify-center gap-3">
                  <span className="flex items-center gap-1"><Coins size={12} color="#d97706" strokeWidth={2} />+{rewards.gold} oro</span>
                  <span className="flex items-center gap-1"><Star size={12} color="#0369a1" strokeWidth={2} />+{rewards.experience} XP</span>
                  <span className="flex items-center gap-1"><Layers size={12} color="#7c3aed" strokeWidth={2} />8% táctica</span>
                </p>
              </div>
              <motion.button
                className="btn btn--primary btn--lg w-full max-w-[280px]"
                onClick={() => previewMutation.mutate()}
                disabled={!anyHeroAvailable}
                whileTap={anyHeroAvailable ? { scale: 0.96 } : {}}
              >
                <Swords size={16} strokeWidth={2} />
                {anyHeroAvailable ? 'Buscar rival' : 'Héroes ocupados'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* SEARCHING */}
        {isSearching && (
          <motion.div
            key="searching"
            className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            <SearchingCard />
          </motion.div>
        )}

        {/* FOUND — reveal dramático */}
        {!isSearching && phase === 'found' && preview && (
          <motion.div key="found" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <RivalRevealCard
              preview={preview}
              enemyClass={enemyClass}
              classColor={classColor}
              tier={enemyTier}
              onAccept={() => setPhase('selecting')}
              onChange={resetSearch}
            />
          </motion.div>
        )}

        {/* SELECTING — rival compacto + picker */}
        {!isSearching && phase === 'selecting' && preview && (
          <motion.div
            key="selecting"
            className="flex flex-col gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Rival */}
            <div
              className="rounded-xl border overflow-hidden shadow-[var(--shadow-sm)]"
              style={{ borderColor: `color-mix(in srgb, ${classColor} 30%, var(--border))` }}
            >
              <div className="px-3 py-1.5 flex items-center gap-1.5"
                style={{ background: `color-mix(in srgb, ${classColor} 8%, var(--surface-2))` }}>
                <Flame size={11} strokeWidth={2.5} style={{ color: classColor }} />
                <span className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: classColor }}>Rival</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-3 bg-surface">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[20px]"
                  style={{
                    background: `color-mix(in srgb, ${classColor} 14%, var(--surface-2))`,
                    border: `1.5px solid color-mix(in srgb, ${classColor} 35%, var(--border))`,
                  }}
                >
                  {enemyClass ? CLASS_ICONS[enemyClass] : <Flame size={18} strokeWidth={1.8} style={{ color: classColor }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-text truncate leading-tight">{preview.enemyName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {enemyClass && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.05em] px-1.5 py-px rounded"
                        style={{ color: classColor, background: `color-mix(in srgb, ${classColor} 12%, var(--surface))`, border: `1px solid color-mix(in srgb, ${classColor} 25%, var(--border))` }}>
                        {CLASS_LABELS[enemyClass]}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold" style={{ color: enemyTier.color }}>{enemyTier.label}</span>
                  </div>
                </div>
                <button
                  className="text-[12px] font-semibold text-text-3 px-3 py-1.5 rounded-lg border border-border bg-surface-2 font-[inherit] cursor-pointer flex-shrink-0"
                  onClick={resetSearch}
                >
                  Cambiar
                </button>
              </div>
            </div>

            {/* Separador VS */}
            <div className="flex items-center gap-3 px-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] font-black text-text-3 tracking-widest">VS</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Tu elección */}
            <div className="rounded-xl border border-[var(--blue-200)] overflow-hidden shadow-[var(--shadow-sm)]"
              style={{ borderColor: 'color-mix(in srgb, var(--blue-500) 35%, var(--border))' }}>
              <div className="px-3 py-1.5 flex items-center gap-1.5"
                style={{ background: 'color-mix(in srgb, var(--blue-500) 8%, var(--surface-2))' }}>
                <Shield size={11} strokeWidth={2.5} className="text-[var(--blue-500)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--blue-600)]">
                  {heroId ? 'Tu héroe' : 'Elige tu héroe'}
                </span>
              </div>
              <div className="p-3 bg-surface flex flex-col gap-3">
                <HeroCombatPicker activeId={heroId} onSelect={setHeroId} activeExtras={activeExtras} />

                {heroId && hero && (
                  <>
                    <PotionPanel heroId={heroId} userId={userId} activeEffects={hero.active_effects ?? {}} title="Pociones de combate" />

                    <motion.button
                      className="btn btn--primary btn--lg btn--full"
                      onClick={startCombat}
                      disabled={combatMutation.isPending || matchmaking || isBusy || !hasEnoughHp}
                      whileTap={combatMutation.isPending || matchmaking || isBusy || !hasEnoughHp ? {} : { scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <Swords size={16} strokeWidth={2} />
                      {combatMutation.isPending || matchmaking
                        ? 'Combatiendo...'
                        : isBusy
                          ? 'Héroe ocupado'
                          : !hasEnoughHp
                            ? 'HP insuficiente (20% mín.)'
                            : '¡Combatir!'}
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>}

    </div>
  )
}
