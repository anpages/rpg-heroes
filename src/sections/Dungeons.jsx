import { useState, useEffect, useRef, useReducer } from 'react'
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
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
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

function ExpeditionProgress({ expedition, onCollect }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [canCollect, setCanCollect] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const mountedRef = useRef(false)

  const totalSeconds = Math.round((new Date(expedition.ends_at) - new Date(expedition.started_at)) / 1000)

  useEffect(() => {
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(expedition.ends_at) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      setCanCollect(remaining === 0 && expedition.id !== '__optimistic__')
    }
    tick()
    requestAnimationFrame(() => { mountedRef.current = true })
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expedition.ends_at, expedition.id])

  const elapsed = totalSeconds - (secondsLeft ?? totalSeconds)
  const pct = Math.min(100, Math.round((elapsed / totalSeconds) * 100))

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
    <div className="flex flex-col gap-2.5 pt-3.5 border-t border-[var(--blue-100)]">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[var(--blue-100)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[linear-gradient(90deg,var(--blue-400),var(--blue-600))] rounded-full"
            style={{ width: `${pct}%`, transition: mountedRef.current ? 'width 1s linear' : 'none' }}
          />
        </div>
        <span className="text-[12px] font-semibold text-[var(--blue-600)] w-[30px] text-right flex-shrink-0">{pct}%</span>
        <span className={`flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap flex-shrink-0 ${canCollect ? 'text-[#16a34a]' : 'text-text-3'}`}>
          <Clock size={12} strokeWidth={2} />
          {canCollect ? 'Lista' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
        </span>
      </div>
      {canCollect && (
        <motion.button
          className="btn btn--primary btn--lg btn--full"
          onClick={handleCollect}
          disabled={collecting}
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <PackageOpen size={16} strokeWidth={2} />
          {collecting ? 'Recogiendo...' : 'Recoger recompensas'}
        </motion.button>
      )}
    </div>
  )
}

function dungeonHpCost(maxHp, difficulty) {
  const pct = difficulty <= 3 ? 0.05 : difficulty <= 6 ? 0.07 : 0.10
  return Math.floor((maxHp ?? 100) * pct)
}

function DungeonCard({ dungeon, heroLevel, heroStatus, expedition, onStart, onCollect, heroHpNow, heroMaxHp }) {
  const locked  = heroLevel < dungeon.min_hero_level
  const isActive = expedition?.dungeon_id === dungeon.id
  const busy    = heroStatus !== 'idle' && !isActive
  const minHp   = Math.floor((heroMaxHp ?? 100) * 0.2)
  const lowHp   = !isActive && !locked && !busy && (heroHpNow ?? minHp) < minHp
  const disabled = locked || busy || lowHp
  const hpCost  = dungeonHpCost(heroMaxHp, dungeon.difficulty)
  const meta    = dungeon.type ? DUNGEON_TYPE_META[dungeon.type] : null

  return (
    <div className={`bg-surface border rounded-xl p-5 shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-200
      ${isActive
        ? 'border-[var(--blue-300)] bg-[color-mix(in_srgb,var(--blue-50)_60%,var(--surface))] dark:border-[var(--blue-600)] dark:bg-[color-mix(in_srgb,var(--blue-600)_8%,var(--surface))]'
        : locked
          ? 'border-border opacity-55'
          : 'border-border hover:shadow-[var(--shadow-md)] hover:border-border-2'
      }`}>

      {/* Top */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-5 mb-4">
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
              {dungeon.duration_minutes >= 60
                ? `${Math.floor(dungeon.duration_minutes / 60)}h${dungeon.duration_minutes % 60 > 0 ? ` ${dungeon.duration_minutes % 60}m` : ''}`
                : `${dungeon.duration_minutes}m`}
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

        {/* Difficulty — row on mobile, column on sm+ */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1.5 flex-shrink-0">
          <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-text-3">Peligro</span>
          <DifficultyDots value={dungeon.difficulty} />
        </div>
      </div>

      {isActive ? (
        <ExpeditionProgress expedition={expedition} onCollect={onCollect} />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pt-3.5 border-t border-border flex-wrap">
          <div className="flex gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[13px] font-semibold text-text-2">
              <Star size={13} strokeWidth={2} color="#0369a1" />{dungeon.experience_reward} XP
            </span>
            <span className="flex items-center gap-1 text-[13px] font-semibold text-[#dc2626]">
              −{hpCost} HP
            </span>
          </div>
          <motion.button
            className="btn btn--primary w-full sm:w-auto"
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
        </div>
      )}
    </div>
  )
}

function interpolateHp(hero, nowMs) {
  if (!hero) return 0
  const lastMs     = hero.hp_last_updated_at ? new Date(hero.hp_last_updated_at).getTime() : nowMs
  const elapsedMin = Math.max(0, (nowMs - lastMs) / 60000)
  const regen      = hero.status === 'exploring' ? 0 : elapsedMin * (100 / 60) * hero.max_hp / 100
  return Math.min(hero.max_hp, Math.floor(hero.current_hp + regen))
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
    const id = setInterval(forceUpdate, 30000)
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
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.heroCards(heroId) })
    setTimeout(() => setReward(null), 6000)
  }

  if (heroLoading || dungeonsLoading || expLoading) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando mazmorras...</div>
  }

  const heroStatus = expedition ? 'exploring' : (hero?.status ?? 'idle')
  const heroHpNow  = interpolateHp(hero, Date.now())

  const agilityReduction = hero ? Math.min(0.25, (hero.agility ?? 0) * 0.003) : 0
  const agilityFactor = 1 - agilityReduction
  const workshopBonus = Math.round((workshopLevel - 1) * 5)

  const isLowHp = heroHpNow < Math.floor((hero?.max_hp ?? 100) * 0.2)

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

      {/* HP bar */}
      {hero && (
        <div className="flex items-center gap-2.5 mb-1">
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-[400ms] ease-out ${isLowHp ? 'bg-[#dc2626]' : 'bg-[#16a34a]'}`}
              style={{ width: `${Math.round((heroHpNow / hero.max_hp) * 100)}%` }}
            />
          </div>
          <span className={`text-[12px] font-semibold whitespace-nowrap ${isLowHp ? 'text-[#dc2626]' : 'text-text-2'}`}>
            {heroHpNow}/{hero.max_hp} HP
          </span>
        </div>
      )}

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
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

export default Dungeons
