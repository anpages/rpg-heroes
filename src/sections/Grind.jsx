import { useState, useEffect, useReducer } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { COMBAT_HP_COST } from '../lib/gameConstants'
import { CLASS_ENEMY_PROFILES } from '../lib/gameFormulas'
import { Swords, Heart, Shield, Coins, Star, Sparkles, Package } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import { TacticsStrip } from '../components/TacticsStrip'

export default function Grind() {
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const navigateToHeroTab    = useAppStore(s => s.navigateToHeroTab)
  const heroId               = useHeroId()
  const queryClient          = useQueryClient()

  const { hero, loading: heroLoading } = useHero(heroId)
  const { items }                      = useInventory(hero?.id)
  const { catalog, inventory }         = useCraftedItems(userId)

  const [result, setResult] = useState(null)
  const [, forceUpdate]     = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

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

  // Coste de HP estimado (porcentaje del max_hp base)
  const hpCostWin  = hero ? Math.round(hero.max_hp * COMBAT_HP_COST.grind.win)  : 0
  const hpCostLoss = hero ? Math.round(hero.max_hp * COMBAT_HP_COST.grind.loss) : 0

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
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
    onError: (err) => {
      notify.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
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
              <span className="text-text-3 font-normal text-[12px]">30% · solo victoria</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-2">
              <Package size={13} color="#6b7280" strokeWidth={2} />
              <span>Ítem</span>
              <span className="text-text-3 font-normal text-[12px]">6% · solo victoria</span>
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

        {/* HP + equipo + pociones */}
        {hero && (
          <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
            <div className="flex justify-between items-center text-[13px] font-semibold text-text-2">
              <span className="flex items-center gap-[5px]"><Heart size={13} strokeWidth={2} color={hpColor} /> HP</span>
              <span style={{ color: hpColor }}>{hpNow} / {effectiveMaxHp}</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width,background] duration-[400ms]${hero.status === 'idle' ? ' animate-hp-regen-pulse' : ''}`}
                style={{ width: `${hpPct}%`, background: hpColor }}
              />
            </div>
            {durPct != null && (
              <>
                <div className="flex justify-between items-center text-[13px] font-semibold text-text-2 mt-1">
                  <span className="flex items-center gap-[5px]"><Shield size={13} strokeWidth={2} color={durColor} /> Equipo</span>
                  <span style={{ color: durColor }}>{durPct}%</span>
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
              <div className="flex items-center gap-2 flex-wrap">
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
