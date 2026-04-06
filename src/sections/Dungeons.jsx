import { useState, useEffect, useReducer } from 'react'
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
import { Coins, Axe, Sparkles, Star, Clock, ChevronRight, PackageOpen, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const listVariants = {
  animate: { transition: { staggerChildren: 0.07 } },
}
const cardVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

function fmtTime(seconds) {
  if (seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
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
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(expedition.ends_at) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      setCanCollect(remaining === 0 && expedition.id !== '__optimistic__')
    }
    tick()
    requestAnimationFrame(() => setIsMounted(true))
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expedition.ends_at, expedition.id])

  const totalSeconds = Math.round((new Date(expedition.ends_at) - new Date(expedition.started_at)) / 1000)
  const elapsed      = totalSeconds - (secondsLeft ?? totalSeconds)
  const pct          = Math.min(100, Math.round((elapsed / totalSeconds) * 100))

  return { secondsLeft, canCollect, isMounted, pct }
}

function dungeonHpCost(maxHp, difficulty) {
  const pct = difficulty <= 3 ? 0.05 : difficulty <= 6 ? 0.07 : 0.10
  return Math.floor((maxHp ?? 100) * pct)
}

function DungeonCard({ dungeon, heroLevel, heroStatus, expedition, onStart, onCollect, heroHpNow, heroMaxHp, agilityFactor }) {
  const locked   = heroLevel < dungeon.min_hero_level
  const isActive = expedition?.dungeon_id === dungeon.id
  const busy     = heroStatus !== 'idle' && !isActive
  const minHp    = Math.floor((heroMaxHp ?? 100) * 0.2)
  const lowHp    = !isActive && !locked && !busy && (heroHpNow ?? minHp) < minHp
  const disabled = locked || busy || lowHp
  const hpCost   = dungeonHpCost(heroMaxHp, dungeon.difficulty)
  const meta     = dungeon.type ? DUNGEON_TYPE_META[dungeon.type] : null

  const [collecting, setCollecting] = useState(false)
  const timer = isActive ? useExpeditionTimer(expedition) : null  // eslint-disable-line react-hooks/rules-of-hooks

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
        ? 'border-[var(--blue-300)] bg-[color-mix(in_srgb,var(--blue-50)_60%,var(--surface))] dark:border-[var(--blue-600)] dark:bg-[color-mix(in_srgb,var(--blue-600)_8%,var(--surface))]'
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
            <div className="flex-1 h-1.5 bg-[var(--blue-100)] dark:bg-[color-mix(in_srgb,var(--blue-600)_20%,var(--surface))] rounded-full overflow-hidden">
              <div
                className="h-full bg-[linear-gradient(90deg,var(--blue-400),var(--blue-600))] rounded-full"
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
    const effectiveMs = Math.round(dungeon.duration_minutes * agilityFactor) * 60000
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
    setTimeout(() => setReward(null), 6000)
  }

  if (heroLoading || dungeonsLoading || expLoading) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando mazmorras...</div>
  }

  const heroStatus = expedition ? 'exploring' : (hero?.status ?? 'idle')
  // eslint-disable-next-line react-hooks/purity
  const heroHpNow  = interpolateHp(hero, Date.now())

  const agilityReduction = hero ? Math.min(0.25, (hero.agility ?? 0) * 0.003) : 0
  const agilityFactor = 1 - agilityReduction
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


      {/* Reward toast */}
      <AnimatePresence>
        {reward && (
          <motion.div
            className="bg-success-bg border border-success-border rounded-[10px] px-[18px] py-3.5 mb-6"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-bold text-[#16a34a]">Recompensas recogidas</p>
              <button className="btn btn--ghost btn--icon" onClick={() => setReward(null)} aria-label="Cerrar">
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="flex gap-4 flex-wrap">
              <span className="flex items-center gap-[5px] text-[13px] font-semibold text-text-2"><Coins size={13} color="#d97706" />{reward.gold} oro</span>
              <span className="flex items-center gap-[5px] text-[13px] font-semibold text-text-2"><Axe size={13} color="#16a34a" />{reward.wood} madera</span>
              <span className="flex items-center gap-[5px] text-[13px] font-semibold text-text-2"><Sparkles size={13} color="#7c3aed" />{reward.mana} maná</span>
              <span className="flex items-center gap-[5px] text-[13px] font-semibold text-text-2"><Star size={13} color="#0369a1" />{reward.experience} XP</span>
            </div>
            {(reward.drop || reward.cardDrop) && (
              <div className="flex flex-col gap-1 pt-2 border-t border-border mt-1">
                {reward.drop?.item_catalog && (
                  <span className="text-[13px] font-bold" style={{ color: RARITY_COLORS[reward.drop.item_catalog.rarity] }}>
                    ⚔ {reward.drop.item_catalog.name}
                  </span>
                )}
                {reward.cardDrop?.skill_cards && (
                  <span className="text-[13px] font-bold" style={{ color: RARITY_COLORS[reward.cardDrop.skill_cards.rarity] }}>
                    ✦ {reward.cardDrop.skill_cards.name}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
