import { useState, useEffect, useReducer, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { trainingRewards } from '../lib/gameFormulas'
import { Swords, Heart, Coins, Star, Shield, Flame, Layers } from 'lucide-react'
import { CLASS_LABELS, CLASS_ICONS, CLASS_COLORS } from '../lib/gameConstants'
import { motion, AnimatePresence } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import RatingBanner from '../components/RatingBanner'
import { tierForRating } from '../lib/combatRating'
import { PotionPanel } from '../components/PotionPanel'
import { TacticsStrip } from '../components/TacticsStrip'
import { HeroCombatPicker } from '../components/HeroPicker'

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

/* ─── Searching rival indicator ─────────────────────────────────────────────── */

function SearchingRival({ searching }) {
  const [dots, setDots] = useState('')
  useEffect(() => {
    if (!searching) return
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(id)
  }, [searching])

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-10 h-10 rounded-xl border border-border bg-surface-2 flex items-center justify-center flex-shrink-0">
        {searching
          ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}><Swords size={18} strokeWidth={1.8} className="text-text-3" /></motion.div>
          : <Swords size={18} strokeWidth={1.8} className="text-text-3" />
        }
      </div>
      <span className="text-[14px] font-semibold text-text-3">
        {searching ? `Buscando rival${dots}` : 'Sin rival asignado'}
      </span>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function QuickCombat() {
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const navigateToHeroTab    = useAppStore(s => s.navigateToHeroTab)
  // heroId gestionado localmente — empieza en null hasta que el jugador elige explícitamente
  const [heroId, setHeroId]  = useState(null)
  const queryClient          = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { items }  = useInventory(heroId)
  const { catalog, inventory } = useCraftedItems(userId)
  const [preview, setPreview]         = useState(null)
  const [matchmaking, setMatchmaking] = useState(false)
  const [pendingResult, setPendingResult] = useState(null)
  const [result, setResult]           = useState(null)
  const [waitingForApi, setWaitingForApi] = useState(false)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

  const nowMs        = Date.now()
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

  const effectiveMaxHp = hero ? hero.max_hp + equipBonuses.max_hp : 100
  const hpNow          = interpolateHp(hero, nowMs, effectiveMaxHp)
  const hasEnoughHp    = hpNow >= Math.floor(effectiveMaxHp * 0.2)
  const isBusy         = hero?.status !== 'idle'
  const rewards        = trainingRewards(hero?.level ?? 1)

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

  const previewMutation = useMutation({
    mutationFn: () => apiPost('/api/quick-combat-preview', {}),
    onSuccess:  (data) => setPreview(data),
    onError:    (err)  => notify.error(err.message),
  })

  const combatMutation = useMutation({
    mutationFn: () => apiPost('/api/quick-combat', { heroId, previewToken: preview?.token }),
    onSuccess:  (data) => setPendingResult(data),
    onError: (err) => {
      setMatchmaking(false)
      if (err.message.includes('INVALID_PREVIEW') || err.message.includes('Token')) {
        setPreview(null)
        notify.error('El rival ha expirado. Busca uno nuevo.')
      } else {
        notify.error(err.message)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
  })

  // Auto-cargar rival al entrar (una sola vez por montaje, no depende del héroe)
  const previewLoadedRef = useRef(false)
  useEffect(() => {
    if (previewLoadedRef.current) return
    previewLoadedRef.current = true
    previewMutation.mutate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startCombat() {
    setPendingResult(null)
    setMatchmaking(true)
    combatMutation.mutate()
  }

  function revealResult(data) {
    setMatchmaking(false)
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

  if (heroLoading) return <div className="text-text-3 text-[14px] p-10 text-center">Cargando...</div>

  const tier       = tierForRating(hero?.combat_rating ?? 0)
  const enemyClass = preview?.enemyClass ?? null
  const classColor = enemyClass ? (CLASS_COLORS[enemyClass] ?? 'var(--text-3)') : tier.color

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Combate Rápido</h2>
        <p className="section-subtitle">Elige el héroe que mandas a combatir según el rival que te toque.</p>
      </div>

      <div className="-mt-5">
        <RatingBanner hero={hero} />
      </div>

      <AnimatePresence>
        {matchmaking && (
          <MatchmakingOverlay
            enemyName={preview?.enemyName ?? '???'}
            onReady={handleAnimationDone}
          />
        )}
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
          onClose={() => { applyPostCombat(result); setResult(null); setPreview(null); previewMutation.mutate() }}
        />
      )}

      {/* Card recompensas */}
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

      {/* Card rival */}
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 shadow-[var(--shadow-sm)]">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Rival asignado</span>

        {!preview ? (
          <SearchingRival searching={!previewMutation.isError} />
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 text-[20px]"
              style={{
                background: `color-mix(in srgb, ${classColor} 14%, var(--surface-2))`,
                borderColor: `color-mix(in srgb, ${classColor} 35%, var(--border))`,
              }}
            >
              {enemyClass ? CLASS_ICONS[enemyClass] : <Flame size={20} strokeWidth={1.8} />}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-bold text-text leading-tight">{preview.enemyName}</span>
              <div className="flex items-center gap-1.5">
                {enemyClass && (
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded"
                    style={{
                      color: classColor,
                      background: `color-mix(in srgb, ${classColor} 12%, var(--surface))`,
                      border: `1px solid color-mix(in srgb, ${classColor} 30%, var(--border))`,
                    }}
                  >
                    {CLASS_LABELS[enemyClass]}
                  </span>
                )}
                <span className="text-[12px] font-semibold" style={{ color: tier.color }}>{tier.label}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card héroe */}
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 shadow-[var(--shadow-sm)]">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">
          {heroId ? 'Tu héroe' : 'Elige tu héroe'}
        </span>

        <HeroCombatPicker locked={!preview} activeId={heroId} onSelect={setHeroId} />

        {!heroId && (
          <p className="text-[13px] text-text-3 text-center py-2">
            Selecciona el héroe que enviará a combatir
          </p>
        )}

        {/* HP + equipo — solo si hay héroe seleccionado */}
        {heroId && hero && (() => {
          const pct        = Math.min(100, Math.round((hpNow / effectiveMaxHp) * 100))
          const hpColor    = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
          const recovering = hero.status === 'idle'
          const full       = hpNow >= effectiveMaxHp
          const equipped   = (items ?? []).filter(i => i.equipped_slot != null && (i.item_catalog?.max_durability ?? 0) > 0)
          const durPct     = equipped.length
            ? Math.round(equipped.reduce((s, i) => s + (i.current_durability / i.item_catalog.max_durability), 0) / equipped.length * 100)
            : null
          const durColor   = durPct == null ? '#6b7280' : durPct > 60 ? '#16a34a' : durPct > 30 ? '#d97706' : '#dc2626'
          return (
            <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
              <div className="flex justify-between items-center text-[13px] font-semibold text-text-2">
                <span className="flex items-center gap-[5px]"><Heart size={13} strokeWidth={2} color={hpColor} /> HP</span>
                <span className="font-medium" style={{ color: hpColor }}>{hpNow} / {effectiveMaxHp}</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width,background] duration-[400ms]${recovering ? ' animate-hp-regen-pulse' : ''}`}
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
          <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Tácticas</span>
            <TacticsStrip heroId={heroId} onNavigate={() => navigateToHeroTab('tacticas')} />
          </div>
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
              ? 'Combatiendo...'
              : isBusy
                ? 'Héroe ocupado'
                : !hasEnoughHp
                  ? 'HP insuficiente (20% mín.)'
                  : '¡Combatir!'}
          </motion.button>
        )}
      </div>
    </div>
  )
}
