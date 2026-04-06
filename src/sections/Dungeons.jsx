import { useState, useEffect, useReducer } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { useHero } from '../hooks/useHero'
import { useBuildings } from '../hooks/useBuildings'
import { useDungeons } from '../hooks/useDungeons'
import { useActiveExpedition } from '../hooks/useActiveExpedition'
import { useWakeLock } from '../hooks/useWakeLock'
import { interpolateHp } from '../lib/hpInterpolation'
import { expeditionHpCost, agilityDurationFactor } from '../lib/gameFormulas'
import { Coins, Axe, Sparkles, Star, Clock, ChevronRight, PackageOpen, X, Sword, Layers } from 'lucide-react'
import { motion } from 'framer-motion'

const listVariants = {
  animate: { transition: { staggerChildren: 0.07 } },
}
const cardVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

function fmtTime(seconds) {
  if (seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3300)
  const m = Math.floor((seconds % 3300) / 60)
  const s = seconds % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

const RARITY_COLORS = {
  common: '#6b7280', uncommon: '#16a34a', rare: '#2563eb', epic: '#7c3aed', legendary: '#d97706',
}

const DUNGEON_TYPE_META = {
  combat:     { label: 'Combate',    color: '#dc2626', loot: 'Armas'                 },
  wilderness: { label: 'Naturaleza', color: '#16a34a', loot: 'Armadura · Accesorios' },
  magic:      { label: 'Arcana',     color: '#7c3aed', loot: 'Accesorios · Cartas'   },
  crypt:      { label: 'Cripta',     color: '#475569', loot: 'Escudos · Armadura'     },
  mine:       { label: 'Mina',       color: '#b45309', loot: 'Armas · Armadura'       },
  ancient:    { label: 'Antigua',    color: '#0369a1', loot: 'Alta rareza · Cartas'   },
}

function DifficultyDots({ value }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`w-[7px] h-[7px] rounded-full ${i < value ? 'bg-[#dc2626]' : 'bg-border'}`}
        />
      ))}
    </div>
  )
}

function useExpeditionTimer(expedition) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [canCollect, setCanCollect]   = useState(false)
  const [isMounted,  setIsMounted]    = useState(false)

  useEffect(() => {
    if (!expedition) return
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(expedition.ends_at) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      setCanCollect(remaining === 0 && expedition.id !== '__optimistic__')
    }
    tick()
    requestAnimationFrame(() => setIsMounted(true))
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expedition?.ends_at, expedition?.id])

  const totalSeconds = expedition
    ? Math.max(1, Math.round((new Date(expedition.ends_at) - new Date(expedition.started_at)) / 1000))
    : 1
  const elapsed = totalSeconds - (secondsLeft ?? totalSeconds)
  const pct     = expedition ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  return { secondsLeft, canCollect, isMounted, pct }
}


function DungeonCard({ dungeon, heroLevel, heroStatus, expedition, onStart, onCollect, heroHpNow, heroMaxHp, agilityFactor }) {
  const locked   = heroLevel < dungeon.min_hero_level
  const isActive = expedition?.dungeon_id === dungeon.id
  const busy     = heroStatus !== 'idle' && !isActive
  const hpCost   = expeditionHpCost(heroMaxHp, dungeon.duration_minutes)
  const lowHp    = !isActive && !locked && !busy && (heroHpNow ?? 0) <= hpCost
  const disabled = locked || busy || lowHp
  const meta     = dungeon.type ? DUNGEON_TYPE_META[dungeon.type] : null

  const [collecting, setCollecting] = useState(false)
  const timer = useExpeditionTimer(isActive ? expedition : null)

  async function handleCollect() {
    setCollecting(true)
    try {
      const data = await apiPost('/api/expedition-collect', { expeditionId: expedition.id })
      onCollect(data)
    } catch (err) {
      toast.error(err.message)
      setCollecting(false)
    }
  }

  return (
    <div className={`flex flex-col bg-surface border rounded-xl p-5 shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-200
      ${isActive
        ? 'border-[var(--blue-300)] bg-[color-mix(in_srgb,var(--blue-50)_60%,var(--surface))] dark:border-[var(--blue-300)] dark:bg-[color-mix(in_srgb,var(--blue-300)_8%,var(--surface))]'
        : locked
          ? 'border-border opacity-55'
          : 'border-border hover:shadow-[var(--shadow-md)] hover:border-border-2'
      }`}>

      {/* Top */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-5 mb-4 flex-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-[17px] font-bold text-text">{dungeon.name}</h3>
            {meta && (
              <span className="text-[11px] font-bold uppercase tracking-[0.07em] opacity-85" style={{ color: meta.color }}>
                {meta.label}
              </span>
            )}
          </div>
          <p className="text-[13px] text-text-3 leading-[1.5] mb-2.5 line-clamp-2">{dungeon.description}</p>
          <div className="flex gap-3.5 flex-wrap">
            <span className="flex items-center gap-1 text-[13px] font-semibold text-text-2">
              <Clock size={13} strokeWidth={2} />
              {(() => {
                const mins = Math.round(dungeon.duration_minutes * (agilityFactor ?? 1))
                return mins >= 60
                  ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`
                  : `${mins}m`
              })()}
            </span>
            <span className="flex items-center gap-1 text-[13px] font-semibold text-text-2">
              <Star size={13} strokeWidth={2} />
              Nv. {dungeon.min_hero_level}+
            </span>
            {meta && (
              <span className="flex items-center gap-1 text-[12px] font-semibold opacity-85" style={{ color: meta.color }}>
                {meta.loot}
              </span>
            )}
          </div>
        </div>

        {/* Difficulty */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1.5 flex-shrink-0">
          <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-text-3">Peligro</span>
          <DifficultyDots value={dungeon.difficulty} />
        </div>
      </div>

      {/* Footer — siempre la misma estructura: info + botón */}
      <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-border">

        {/* Info izquierda */}
        {isActive ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 h-1.5 bg-[var(--blue-100)] dark:bg-[color-mix(in_srgb,var(--blue-300)_20%,var(--surface))] rounded-full overflow-hidden">
              <div
                className="h-full bg-[linear-gradient(90deg,var(--blue-400),var(--blue-300))] rounded-full"
                style={{ width: `${timer.pct}%`, transition: timer.isMounted ? 'width 1s linear' : 'none' }}
              />
            </div>
            <span className={`text-[12px] font-semibold whitespace-nowrap flex-shrink-0 ${timer.canCollect ? 'text-[#16a34a]' : 'text-text-3'}`}>
              {timer.canCollect ? '¡Lista!' : timer.secondsLeft !== null ? fmtTime(timer.secondsLeft) : '...'}
            </span>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[13px] font-semibold text-text-2">
              <Star size={13} strokeWidth={2} color="#0369a1" />{dungeon.experience_reward} XP
            </span>
            <span className="flex items-center gap-1 text-[13px] font-semibold text-[#dc2626]">
              −{hpCost} HP
            </span>
          </div>
        )}

        {/* Botón derecha — siempre presente */}
        {isActive ? (
          <motion.button
            className="btn btn--primary flex-shrink-0"
            onClick={handleCollect}
            disabled={!timer.canCollect || collecting}
            whileTap={(!timer.canCollect || collecting) ? {} : { scale: 0.96 }}
            whileHover={(!timer.canCollect || collecting) ? {} : { scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <PackageOpen size={15} strokeWidth={2} />
            {collecting ? 'Recogiendo...' : 'Recoger'}
          </motion.button>
        ) : (
          <motion.button
            className="btn btn--primary flex-shrink-0"
            onClick={() => onStart(dungeon)}
            disabled={disabled}
            whileTap={disabled ? {} : { scale: 0.96 }}
            whileHover={disabled ? {} : { scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {locked
              ? `Nv. ${dungeon.min_hero_level} requerido`
              : busy
                ? 'Héroe ocupado'
                : lowHp
                  ? 'HP insuficiente'
                  : <><span>Explorar</span><ChevronRight size={15} strokeWidth={2} /></>
            }
          </motion.button>
        )}

      </div>{/* /footer */}
    </div>
  )
}

function RewardModal({ reward, onClose }) {
  const hasDrop = reward.drop?.item_catalog || reward.cardDrop?.skill_cards
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <motion.div
        className="relative bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-sm overflow-hidden"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <div>
            <p className="text-[17px] font-bold text-text">¡Expedición completada!</p>
            <p className="text-[13px] text-text-3 mt-0.5">Has vuelto con recompensas</p>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Cerrar">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Resources */}
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#d97706_8%,var(--bg))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] rounded-xl px-3.5 py-3">
            <Coins size={18} color="#d97706" strokeWidth={2} />
            <div>
              <p className="text-[18px] font-bold text-text leading-none">{reward.gold}</p>
              <p className="text-[11px] text-text-3 mt-0.5">Oro</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#16a34a_8%,var(--bg))] border border-[color-mix(in_srgb,#16a34a_25%,var(--border))] rounded-xl px-3.5 py-3">
            <Axe size={18} color="#16a34a" strokeWidth={2} />
            <div>
              <p className="text-[18px] font-bold text-text leading-none">{reward.wood}</p>
              <p className="text-[11px] text-text-3 mt-0.5">Madera</p>
            </div>
          </div>
          {reward.mana > 0 && (
            <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#7c3aed_8%,var(--bg))] border border-[color-mix(in_srgb,#7c3aed_25%,var(--border))] rounded-xl px-3.5 py-3">
              <Sparkles size={18} color="#7c3aed" strokeWidth={2} />
              <div>
                <p className="text-[18px] font-bold text-text leading-none">{reward.mana}</p>
                <p className="text-[11px] text-text-3 mt-0.5">Maná</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#0369a1_8%,var(--bg))] border border-[color-mix(in_srgb,#0369a1_25%,var(--border))] rounded-xl px-3.5 py-3">
            <Star size={18} color="#0369a1" strokeWidth={2} />
            <div>
              <p className="text-[18px] font-bold text-text leading-none">{reward.experience}</p>
              <p className="text-[11px] text-text-3 mt-0.5">XP</p>
            </div>
          </div>
        </div>

        {/* Item / card drop */}
        {hasDrop && (
          <div className="flex flex-col gap-2 px-5 pb-4">
            {reward.drop?.item_catalog && (
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3 border"
                style={{
                  backgroundColor: `color-mix(in srgb, ${RARITY_COLORS[reward.drop.item_catalog.rarity]} 8%, var(--bg))`,
                  borderColor:     `color-mix(in srgb, ${RARITY_COLORS[reward.drop.item_catalog.rarity]} 30%, var(--border))`,
                }}
              >
                <Sword size={16} strokeWidth={2} style={{ color: RARITY_COLORS[reward.drop.item_catalog.rarity], flexShrink: 0 }} />
                <div className="min-w-0">
                  <p className="text-[14px] font-bold truncate" style={{ color: RARITY_COLORS[reward.drop.item_catalog.rarity] }}>
                    {reward.drop.item_catalog.name}
                  </p>
                  <p className="text-[11px] text-text-3 capitalize">{reward.drop.item_catalog.rarity} · {reward.drop.item_catalog.slot}</p>
                </div>
              </div>
            )}
            {reward.cardDrop?.skill_cards && (
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3 border"
                style={{
                  backgroundColor: `color-mix(in srgb, ${RARITY_COLORS[reward.cardDrop.skill_cards.rarity]} 8%, var(--bg))`,
                  borderColor:     `color-mix(in srgb, ${RARITY_COLORS[reward.cardDrop.skill_cards.rarity]} 30%, var(--border))`,
                }}
              >
                <Layers size={16} strokeWidth={2} style={{ color: RARITY_COLORS[reward.cardDrop.skill_cards.rarity], flexShrink: 0 }} />
                <div className="min-w-0">
                  <p className="text-[14px] font-bold truncate" style={{ color: RARITY_COLORS[reward.cardDrop.skill_cards.rarity] }}>
                    {reward.cardDrop.skill_cards.name}
                  </p>
                  <p className="text-[11px] text-text-3 capitalize">Carta · {reward.cardDrop.skill_cards.rarity}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5">
          <button className="btn btn--primary btn--full" onClick={onClose}>
            Continuar
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Dungeons() {
  const userId      = useAppStore(s => s.userId)
  const heroId      = useHeroId()
  const queryClient = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { dungeons, loading: dungeonsLoading } = useDungeons()
  const { expedition, loading: expLoading, setExpedition } = useActiveExpedition(hero?.id)
  const { buildings } = useBuildings(userId)
  const workshopLevel = buildings?.find(b => b.type === 'workshop')?.level ?? 1
  const [reward, setReward] = useState(null)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

  useWakeLock(!!expedition)

  async function handleStart(dungeon) {
    const now = Date.now()
    const effectiveMs = Math.round(dungeon.duration_minutes * agilityFactor) * 30000
    setExpedition({
      id: '__optimistic__',
      dungeon_id: dungeon.id,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + effectiveMs).toISOString(),
    })

    try {
      const data = await apiPost('/api/expedition-start', { dungeonId: dungeon.id, heroId: hero?.id })
      setExpedition(exp => exp ? { ...exp, ends_at: data.endsAt } : exp)
      queryClient.invalidateQueries({ queryKey: queryKeys.activeExpedition(hero?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    } catch (err) {
      setExpedition(null)
      toast.error(err.message)
    }
  }

  function handleCollect(data) {
    setReward({ ...data.rewards, drop: data.drop ?? null, cardDrop: data.cardDrop ?? null })
    setExpedition(null)
    queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.heroCards(heroId) })
  }

  if (heroLoading || dungeonsLoading || expLoading) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando mazmorras...</div>
  }

  const heroStatus = expedition ? 'exploring' : (hero?.status ?? 'idle')
  // eslint-disable-next-line react-hooks/purity
  const heroHpNow  = interpolateHp(hero, Date.now())

  const agilityFactor = hero ? agilityDurationFactor(hero.agility) : 1
  const workshopBonus = Math.round((workshopLevel - 1) * 5)


  return (
    <div className="dungeons-section">
      <div className="section-header">
        <div className="section-title-row">
          <h2 className="section-title">Mazmorras</h2>
          {workshopBonus > 0 && (
            <span className="workshop-bonus-badge">+{workshopBonus}% botín</span>
          )}
        </div>
        <p className="section-subtitle">Envía a tu héroe a explorar mazmorras para conseguir recursos, experiencia y equipo. El botín es aleatorio; cada tipo tiene sus especialidades.</p>
      </div>


      {/* Reward modal */}
      {reward && createPortal(
        <RewardModal reward={reward} onClose={() => setReward(null)} />,
        document.body
      )}

      {/* Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        {dungeons?.map(dungeon => (
          <motion.div key={dungeon.id} variants={cardVariants}>
            <DungeonCard
              dungeon={dungeon}
              heroLevel={hero?.level ?? 1}
              heroStatus={heroStatus}
              onStart={handleStart}
              expedition={expedition}
              onCollect={handleCollect}
              heroHpNow={heroHpNow}
              heroMaxHp={hero?.max_hp ?? 100}
              agilityFactor={agilityFactor}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

export default Dungeons
