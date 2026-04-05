import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useHero } from '../hooks/useHero'
import { useDungeons } from '../hooks/useDungeons'
import { useActiveExpedition } from '../hooks/useActiveExpedition'
import { useWakeLock } from '../hooks/useWakeLock'
import { Coins, Axe, Sparkles, Star, Clock, ChevronRight, PackageOpen, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './Dungeons.css'

const listVariants = {
  animate: { transition: { staggerChildren: 0.07 } },
}
const cardVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
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
    <div className="difficulty-dots">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`dot ${i < value ? 'dot--filled' : ''}`} />
      ))}
    </div>
  )
}

function ExpeditionProgress({ expedition, onCollect }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [canCollect, setCanCollect] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [collectError, setCollectError] = useState(null)
  const mountedRef = useRef(false)

  const totalSeconds = Math.round((new Date(expedition.ends_at) - new Date(expedition.started_at)) / 1000)

  useEffect(() => {
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(expedition.ends_at) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      // Solo se puede recoger si hay un id real (no optimista)
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
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/expedition-collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ expeditionId: expedition.id }),
    })
    const data = await res.json()
    if (res.ok) onCollect(data)
    else { setCollectError(data.error ?? 'Error al recoger recompensas'); setCollecting(false) }
  }

  return (
    <div className="exp-progress">
      <div className="exp-progress-row">
        <div className="exp-progress-track">
          <div
            className="exp-progress-fill"
            style={{ width: `${pct}%`, transition: mountedRef.current ? 'width 1s linear' : 'none' }}
          />
        </div>
        <span className="exp-progress-pct">{pct}%</span>
        <span className={`exp-progress-timer ${canCollect ? 'exp-progress-timer--done' : ''}`}>
          <Clock size={12} strokeWidth={2} />
          {canCollect ? 'Lista' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
        </span>
      </div>
      {canCollect && (
        <>
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
          {collectError && <p className="collect-error">{collectError}</p>}
        </>
      )}
    </div>
  )
}

// DungeonCard es puro display: no hace fetch, onStart(dungeon) dispara la lógica en el padre
function DungeonCard({ dungeon, heroLevel, heroStatus, expedition, onStart, onCollect }) {
  const locked = heroLevel < dungeon.min_hero_level
  const isActive = expedition?.dungeon_id === dungeon.id
  const busy = heroStatus !== 'idle' && !isActive
  const disabled = locked || busy

  return (
    <div className={`dungeon-card ${locked ? 'dungeon-card--locked' : ''} ${isActive ? 'dungeon-card--active' : ''}`}>
      <div className="dungeon-card-top">
        <div className="dungeon-main">
          <div className="dungeon-name-row">
            <h3 className="dungeon-name">{dungeon.name}</h3>
            {dungeon.type && DUNGEON_TYPE_META[dungeon.type] && (
              <span className="dungeon-type-badge" style={{ color: DUNGEON_TYPE_META[dungeon.type].color }}>
                {DUNGEON_TYPE_META[dungeon.type].label}
              </span>
            )}
          </div>
          <p className="dungeon-desc">{dungeon.description}</p>
          <div className="dungeon-meta">
            <span className="dungeon-meta-item">
              <Clock size={13} strokeWidth={2} />
              {dungeon.duration_minutes >= 60
                ? `${Math.floor(dungeon.duration_minutes / 60)}h${dungeon.duration_minutes % 60 > 0 ? ` ${dungeon.duration_minutes % 60}m` : ''}`
                : `${dungeon.duration_minutes}m`}
            </span>
            <span className="dungeon-meta-item">
              <Star size={13} strokeWidth={2} />
              Nv. {dungeon.min_hero_level}+
            </span>
            {dungeon.type && DUNGEON_TYPE_META[dungeon.type] && (
              <span className="dungeon-meta-item dungeon-loot-hint" style={{ color: DUNGEON_TYPE_META[dungeon.type].color }}>
                {DUNGEON_TYPE_META[dungeon.type].loot}
              </span>
            )}
          </div>
        </div>
        <div className="dungeon-difficulty">
          <span className="dungeon-difficulty-label">Peligro</span>
          <DifficultyDots value={dungeon.difficulty} />
        </div>
      </div>

      {isActive ? (
        <ExpeditionProgress expedition={expedition} onCollect={onCollect} />
      ) : (
        <div className="dungeon-card-bottom">
          <div className="dungeon-rewards">
            <span className="reward-item"><Star size={13} strokeWidth={2} color="#0369a1" />{dungeon.experience_reward} XP</span>
          </div>
          <motion.button
            className="btn btn--primary"
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
                : <><span>Explorar</span><ChevronRight size={15} strokeWidth={2} /></>
            }
          </motion.button>
        </div>
      )}
    </div>
  )
}

function Dungeons({ userId, heroId, onResourceChange, onHeroChange, onExpeditionStart, workshopLevel = 1 }) {
  const { hero, loading: heroLoading, refetch: refetchHero } = useHero(heroId)
  const { dungeons, loading: dungeonsLoading } = useDungeons()
  const { expedition, loading: expLoading, setExpedition, refetch } = useActiveExpedition(hero?.id)
  const [reward, setReward] = useState(null)
  const [startError, setStartError] = useState(null)

  useWakeLock(!!expedition)

  // Optimistic start: la card muestra progreso al instante, la API confirma en background
  async function handleStart(dungeon) {
    const now = Date.now()
    const effectiveMs = Math.round(dungeon.duration_minutes * agilityFactor) * 60000
    setStartError(null)

    setExpedition({
      id: '__optimistic__',
      dungeon_id: dungeon.id,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + effectiveMs).toISOString(),
    })

    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/expedition-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ dungeonId: dungeon.id, heroId: hero?.id }),
    })

    const data = await res.json()
    if (res.ok) {
      // Corregir ends_at optimista con el valor real del servidor
      setExpedition(exp => exp ? { ...exp, ends_at: data.endsAt } : exp)
      refetch()
      onExpeditionStart?.()
    } else {
      setExpedition(null) // revertir
      setStartError(data.error ?? 'Error al iniciar expedición')
      setTimeout(() => setStartError(null), 4000)
    }
  }

  function handleCollect(data) {
    setReward({ ...data.rewards, drop: data.drop ?? null, cardDrop: data.cardDrop ?? null })
    setExpedition(null)
    refetchHero()
    onResourceChange?.()
    onHeroChange?.()
    setTimeout(() => setReward(null), 6000)
  }

  if (heroLoading || dungeonsLoading || expLoading) {
    return <div className="dungeons-loading">Cargando mazmorras...</div>
  }

  const heroStatus = expedition ? 'exploring' : (hero?.status ?? 'idle')

  const agilityReduction = hero ? Math.min(0.25, (hero.agility ?? 0) * 0.003) : 0
  const agilityFactor = 1 - agilityReduction
  const workshopBonus = Math.round((workshopLevel - 1) * 5) // +5% por nivel

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

      <AnimatePresence>
        {reward && (
          <motion.div
            className="reward-toast"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="reward-toast-header">
              <p className="reward-toast-title">Recompensas recogidas</p>
              <button className="btn btn--ghost btn--icon" onClick={() => setReward(null)} aria-label="Cerrar"><X size={14} strokeWidth={2} /></button>
            </div>
            <div className="reward-toast-items">
              <span><Coins size={13} color="#d97706" />{reward.gold} oro</span>
              <span><Axe size={13} color="#16a34a" />{reward.wood} madera</span>
              <span><Sparkles size={13} color="#7c3aed" />{reward.mana} maná</span>
              <span><Star size={13} color="#0369a1" />{reward.experience} XP</span>
            </div>
            {(reward.drop || reward.cardDrop) && (
              <div className="reward-toast-drops">
                {reward.drop?.item_catalog && (
                  <span className="reward-drop-item" style={{ '--drop-color': RARITY_COLORS[reward.drop.item_catalog.rarity] }}>
                    ⚔ {reward.drop.item_catalog.name}
                  </span>
                )}
                {reward.cardDrop?.skill_cards && (
                  <span className="reward-drop-item" style={{ '--drop-color': RARITY_COLORS[reward.cardDrop.skill_cards.rarity] }}>
                    ✦ {reward.cardDrop.skill_cards.name}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}
        {startError && (
          <motion.p
            className="collect-error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ marginBottom: 12 }}
          >
            {startError}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div
        className="dungeons-grid"
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
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

export default Dungeons
