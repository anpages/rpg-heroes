import { useState, useEffect, useReducer } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { useResources } from '../hooks/useResources'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { COMBAT_HP_COST } from '../lib/gameConstants'
import { CLASS_ENEMY_PROFILES } from '../lib/gameFormulas'
import { Swords, Heart, Shield, Coins, Star, Sparkles, Package, Wrench, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import { TacticsStrip } from '../components/TacticsStrip'

const RARITY_GOLD_PER_POINT = { common: 2, uncommon: 3, rare: 6, epic: 12, legendary: 22 }
function repairItemCost(item) {
  const missing = item.item_catalog.max_durability - item.current_durability
  return missing * (RARITY_GOLD_PER_POINT[item.item_catalog.rarity] ?? 2)
}

const overlayVariants = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
const sheetVariants   = {
  initial: { y: '100%' },
  animate: { y: 0,      transition: { type: 'tween', ease: [0.0, 0.0, 0.2, 1], duration: 0.26 } },
  exit:    { y: '100%', transition: { type: 'tween', ease: [0.4, 0.0, 1, 1],   duration: 0.18 } },
}

function RepairAllModal({ damagedItems, gold, onConfirm, onCancel }) {
  const totalGold = damagedItems.reduce((sum, i) => sum + repairItemCost(i), 0)
  const hasGold   = gold >= totalGold
  return createPortal(
    <motion.div
      className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center sm:p-5"
      variants={overlayVariants} initial="initial" animate="animate" exit="exit"
      transition={{ duration: 0.15 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-bg border border-border-2 rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 p-5 w-full"
        style={{ maxWidth: 'min(360px, 100vw)' }}
        variants={sheetVariants} initial="initial" animate="animate" exit="exit"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-text">Reparar todo el equipo</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3" onClick={onCancel}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            {damagedItems.map(i => (
              <div key={i.id} className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-text-2 truncate">{i.item_catalog.name}</span>
                <span className="text-[12px] font-medium text-text flex-shrink-0">{repairItemCost(i)} oro</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-text">Total</span>
              <span className={`text-[13px] font-bold ${hasGold ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                {totalGold} oro
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-2">Tu oro</span>
              <span className="text-[13px] font-semibold text-text">{gold}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end items-center">
          {!hasGold && (
            <span className="text-[11px] font-semibold text-[#dc2626] mr-auto">Oro insuficiente</span>
          )}
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn--primary btn--sm disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={!hasGold}
          >
            Reparar todo
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

export default function Grind() {
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const navigateToHeroTab    = useAppStore(s => s.navigateToHeroTab)
  const heroId               = useHeroId()
  const queryClient          = useQueryClient()

  const { hero, loading: heroLoading } = useHero(heroId)
  const { items }                      = useInventory(hero?.id)
  const { catalog, inventory }         = useCraftedItems(userId)
  const { resources }                  = useResources(userId)

  const [result, setResult]       = useState(null)
  const [showRepair, setShowRepair] = useState(false)
  const [, forceUpdate]           = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

  const hpPotions = (catalog ?? [])
    .filter(c => c.effects?.some(e => e.type === 'hp_restore') && (inventory[c.id] ?? 0) > 0)
    .map(c => ({ ...c, quantity: inventory[c.id] ?? 0 }))

  const itemUseMutation = useMutation({
    mutationKey: ['item-use', heroId],
    mutationFn: (recipeId) => apiPost('/api/item-use', { heroId: hero?.id, recipeId }),
    onMutate: async (recipeId) => {
      const heroKey    = queryKeys.hero(heroId)
      const craftedKey = queryKeys.craftedItems(userId)
      await queryClient.cancelQueries({ queryKey: heroKey })
      await queryClient.cancelQueries({ queryKey: craftedKey })
      const prevHero    = queryClient.getQueryData(heroKey)
      const prevCrafted = queryClient.getQueryData(craftedKey)
      // HP optimista: +40% max_hp, cap a effectiveMaxHp
      queryClient.setQueryData(heroKey, h => h ? {
        ...h,
        current_hp:         Math.min(effectiveMaxHp, (h.current_hp ?? 0) + Math.round(effectiveMaxHp * 0.40)),
        hp_last_updated_at: new Date().toISOString(),
      } : h)
      // Cantidad optimista: -1 poción
      queryClient.setQueryData(craftedKey, d => d ? {
        ...d,
        inventory: { ...d.inventory, [recipeId]: Math.max(0, (d.inventory?.[recipeId] ?? 1) - 1) },
      } : d)
      return { prevHero, prevCrafted }
    },
    onError: (err, _recipeId, ctx) => {
      if (ctx?.prevHero)    queryClient.setQueryData(queryKeys.hero(heroId), ctx.prevHero)
      if (ctx?.prevCrafted) queryClient.setQueryData(queryKeys.craftedItems(userId), ctx.prevCrafted)
      notify.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) })
    },
  })

  const nowMs          = Date.now()
  const equipBonuses   = (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .reduce((acc, i) => {
      const c = i.item_catalog
      acc.max_hp += c.hp_bonus ?? 0
      return acc
    }, { max_hp: 0 })

  const effectiveMaxHp = (hero?.max_hp ?? 100) + equipBonuses.max_hp
  const hpNow          = interpolateHp(hero, nowMs, effectiveMaxHp)
  const minHp          = Math.floor(effectiveMaxHp * 0.2)
  const hasEnoughHp    = hpNow >= minHp
  const isBusy         = hero?.status !== 'idle'

  const hpCostWin  = hero ? Math.round(hero.max_hp * COMBAT_HP_COST.grind.win)  : 0
  const hpCostLoss = hero ? Math.round(hero.max_hp * COMBAT_HP_COST.grind.loss) : 0

  const damagedEquipped = (items ?? []).filter(
    i => i.equipped_slot && (i.item_catalog?.max_durability ?? 0) > 0 && i.current_durability < i.item_catalog.max_durability
  )

  const applyPostCombat = (data) => {
    if (!data) return
    if (data.rewards?.drop?.item_catalog) notify.itemDrop(data.rewards.drop.item_catalog)
    if (data.rewards?.drop?.full)         notify.bagFull()
    triggerResourceFlash()
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.combatHistory(heroId) })
    if (data.rewards?.drop)    queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
    if (data.rewards?.tactic)  queryClient.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) })
  }

  const fightMutation = useMutation({
    mutationFn: () => apiPost('/api/grind-combat', { heroId: hero?.id }),
    onSuccess: (data) => {
      setResult(data)
      // Aplicar HP y durabilidad al instante desde la respuesta, sin esperar el refetch
      queryClient.setQueryData(queryKeys.hero(heroId), h => h ? {
        ...h,
        current_hp:         data.heroCurrentHp,
        hp_last_updated_at: new Date().toISOString(),
      } : h)
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
    },
    onError: (err) => {
      notify.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
  })

  const repairMutation = useMutation({
    mutationKey: ['repair'],
    mutationFn: () => apiPost('/api/item-repair-all', { heroId: hero?.id }),
    onMutate: async () => {
      setShowRepair(false)
      const key = queryKeys.inventory(heroId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (previous ?? []).map(i =>
        i.equipped_slot ? { ...i, current_durability: i.item_catalog.max_durability } : i
      ))
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous !== undefined) queryClient.setQueryData(queryKeys.inventory(heroId), ctx.previous)
      notify.error(err.message)
    },
    onSettled: () => {
      triggerResourceFlash()
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
  })

  if (heroLoading) return <div className="text-text-3 text-[14px] p-10 text-center">Cargando...</div>

  const classProf = CLASS_ENEMY_PROFILES[hero?.class]
  const equipped  = (items ?? []).filter(i => i.equipped_slot != null && (i.item_catalog?.max_durability ?? 0) > 0)
  const durPct    = equipped.length
    ? Math.round(equipped.reduce((s, i) => s + (i.current_durability / i.item_catalog.max_durability), 0) / equipped.length * 100)
    : null
  const hpColor  = hpNow > effectiveMaxHp * 0.6 ? '#0369a1' : hpNow > effectiveMaxHp * 0.3 ? '#d97706' : '#dc2626'
  const durColor = durPct == null ? '#6b7280' : durPct > 60 ? '#16a34a' : durPct > 30 ? '#d97706' : '#dc2626'
  const hpPct    = Math.min(100, Math.round((hpNow / effectiveMaxHp) * 100))
  const full     = hpNow >= effectiveMaxHp

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Combate de Grindeo</h2>
        <p className="section-subtitle">Combates rápidos contra un rival de tu clase para acumular drops mientras juegas activo.</p>
      </div>

      {result && (
        <CombatReplay
          heroName={hero?.name ?? 'Héroe'}
          enemyName={result.enemyName}
          heroMaxHp={result.heroMaxHp}
          enemyMaxHp={result.enemyMaxHp}
          log={result.log ?? []}
          won={result.won}
          rewards={result.rewards}
          heroClass={result.heroClass}
          archetype={result.heroClass}
          enemyTactics={result.enemyTactics}
          onClose={() => { applyPostCombat(result); setResult(null) }}
        />
      )}

      <AnimatePresence>
        {showRepair && (
          <RepairAllModal
            damagedItems={damagedEquipped}
            gold={resources?.gold ?? 0}
            onConfirm={() => repairMutation.mutate()}
            onCancel={() => setShowRepair(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel de combate */}
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 shadow-[var(--shadow-sm)]">

        {/* Enemigo */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Rival</span>
            <div className="flex items-center gap-2">
              {classProf && (
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded"
                  style={{
                    color: classProf.color,
                    background: `color-mix(in srgb, ${classProf.color} 12%, var(--surface))`,
                    border: `1px solid color-mix(in srgb, ${classProf.color} 30%, var(--border))`,
                  }}
                >
                  {classProf.label}
                </span>
              )}
              <span className="text-[13px] text-text-3 font-medium">nivel proporcional al tuyo · tácticas variadas</span>
            </div>
          </div>
        </div>

        {/* Drops posibles */}
        <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Drops posibles</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
              <Coins size={13} color="#d97706" strokeWidth={2} />
              <span>Oro</span>
              <span className="text-text-3 font-normal text-[12px]">siempre</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
              <Star size={13} color="#0369a1" strokeWidth={2} />
              <span>XP</span>
              <span className="text-text-3 font-normal text-[12px]">siempre</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
              <Sparkles size={13} color="#f59e0b" strokeWidth={2} />
              <span>Fragmentos</span>
              <span className="text-text-3 font-normal text-[12px]">15% · solo victoria</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
              <Package size={13} color="#6b7280" strokeWidth={2} />
              <span>Ítem</span>
              <span className="text-text-3 font-normal text-[12px]">15% · solo victoria</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1 pt-1.5 border-t border-border text-[12px] text-text-3">
            <span>Coste HP: <span className="font-semibold text-text-2">{hpCostWin} victoria</span> / <span className="font-semibold text-text-2">{hpCostLoss} derrota</span></span>
          </div>
        </div>

        {/* Estadísticas de grindeo */}
        {hero && (hero.combats_played ?? 0) > 0 && (() => {
          const played  = hero.combats_played ?? 0
          const won     = hero.combats_won ?? 0
          const winRate = Math.round((won / played) * 100)
          return (
            <div className="flex items-center gap-4 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
              <div className="flex flex-col">
                <span className="text-[11px] text-text-3">Victorias</span>
                <span className="text-[14px] font-bold tabular-nums text-[#16a34a]">{won}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-text-3">Derrotas</span>
                <span className="text-[14px] font-bold tabular-nums text-[#dc2626]">{played - won}</span>
              </div>
              <div className="flex flex-col ml-auto text-right">
                <span className="text-[11px] text-text-3">Winrate</span>
                <span className="text-[14px] font-bold tabular-nums text-text">{winRate}%</span>
              </div>
            </div>
          )
        })()}

        {/* HP + equipo */}
        {hero && (
          <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">

            {/* HP row */}
            <div className="flex items-center gap-2">
              <Heart size={13} strokeWidth={2} color={hpColor} className="flex-shrink-0" />
              <span className="text-[13px] font-semibold text-text-2 flex-shrink-0">HP</span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                {hpPotions.map(p => {
                  const disabled = full || isBusy || itemUseMutation.isPending
                  return (
                    <motion.button
                      key={p.id}
                      className="flex items-center gap-1 px-1.5 py-[3px] rounded border text-[11px] font-bold transition-opacity duration-150 disabled:opacity-35"
                      style={{ color: '#16a34a', borderColor: 'color-mix(in srgb, #16a34a 30%, var(--border))', background: 'color-mix(in srgb, #16a34a 8%, var(--surface))' }}
                      onClick={() => !disabled && itemUseMutation.mutate(p.id)}
                      disabled={disabled}
                      whileTap={disabled ? {} : { scale: 0.92 }}
                    >
                      <Heart size={10} strokeWidth={2.5} />
                      ×{p.quantity}
                    </motion.button>
                  )
                })}
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: hpColor }}>{hpNow}/{effectiveMaxHp}</span>
              </div>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width,background] duration-[400ms]${hero.status === 'idle' ? ' animate-hp-regen-pulse' : ''}`}
                style={{ width: `${hpPct}%`, background: hpColor }}
              />
            </div>

            {/* Equipo row */}
            {durPct != null && (
              <>
                <div className="flex items-center gap-2 mt-1">
                  <Shield size={13} strokeWidth={2} color={durColor} className="flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-text-2 flex-shrink-0">Equipo</span>
                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <motion.button
                      className="flex items-center gap-1 px-1.5 py-[3px] rounded border text-[11px] font-bold transition-opacity duration-150 disabled:opacity-35"
                      style={{ color: '#d97706', borderColor: 'color-mix(in srgb, #d97706 30%, var(--border))', background: 'color-mix(in srgb, #d97706 8%, var(--surface))' }}
                      onClick={() => damagedEquipped.length > 0 && setShowRepair(true)}
                      disabled={damagedEquipped.length === 0}
                      whileTap={damagedEquipped.length === 0 ? {} : { scale: 0.92 }}
                    >
                      <Wrench size={10} strokeWidth={2.5} />
                      Reparar
                    </motion.button>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: durColor }}>{durPct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width,background] duration-[400ms]"
                    style={{ width: `${durPct}%`, background: durColor }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Tácticas */}
        <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Tus tácticas</span>
          <TacticsStrip heroId={heroId} onNavigate={() => navigateToHeroTab('tacticas')} />
        </div>

        <motion.button
          className="btn btn--primary btn--lg btn--full"
          onClick={() => { setResult(null); fightMutation.mutate() }}
          disabled={fightMutation.isPending || isBusy || !hasEnoughHp}
          whileTap={fightMutation.isPending || isBusy || !hasEnoughHp ? {} : { scale: 0.96 }}
          whileHover={fightMutation.isPending || isBusy || !hasEnoughHp ? {} : { scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Swords size={16} strokeWidth={2} />
          {fightMutation.isPending ? 'Combatiendo...' : isBusy ? 'Héroe ocupado' : !hasEnoughHp ? `HP insuficiente (mín. ${minHp})` : 'Combatir'}
        </motion.button>
      </div>
    </div>
  )
}
