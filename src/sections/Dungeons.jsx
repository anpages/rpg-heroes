import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useHero } from '../hooks/useHero'
import { useDungeons } from '../hooks/useDungeons'
import { useActiveExpedition } from '../hooks/useActiveExpedition'
import { useWakeLock } from '../hooks/useWakeLock'
import { Coins, Axe, Sparkles, Star, Clock, Swords, ChevronRight, PackageOpen } from 'lucide-react'
import './Dungeons.css'


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

function DifficultyDots({ value }) {
  return (
    <div className="difficulty-dots">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`dot ${i < value ? 'dot--filled' : ''}`} />
      ))}
    </div>
  )
}

// Fix 3: la barra no anima en el primer render
function ActiveExpedition({ expedition, onCollect }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [canCollect, setCanCollect] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [collectError, setCollectError] = useState(null)
  const mountedRef = useRef(false)

  const totalSeconds = expedition.dungeons.duration_minutes * 60

  useEffect(() => {
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(expedition.ends_at) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      setCanCollect(remaining === 0)
    }
    tick()
    // Marcar como montado tras el primer tick para habilitar la transición
    requestAnimationFrame(() => { mountedRef.current = true })
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expedition.ends_at])

  const elapsed = totalSeconds - (secondsLeft ?? totalSeconds)
  const pct = Math.min(100, Math.round((elapsed / totalSeconds) * 100))
  const name = expedition.dungeons.name

  async function handleCollect() {
    setCollecting(true)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/expedition-collect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ expeditionId: expedition.id }),
    })
    const data = await res.json()
    if (res.ok) onCollect(data)
    else {
      setCollectError(data.error ?? 'Error al recoger recompensas')
      setCollecting(false)
    }
  }

  return (
    <div className="active-expedition">
      <div className="active-exp-header">
        <div>
          <p className="active-exp-label">Expedición activa</p>
          <h3 className="active-exp-name">{name}</h3>
        </div>
        <div className="active-exp-timer">
          <Clock size={14} strokeWidth={2} />
          {canCollect ? 'Completada' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
        </div>
      </div>

      <div className="active-exp-bar-wrap">
        <div className="active-exp-track">
          <div
            className="active-exp-fill"
            style={{
              width: `${pct}%`,
              transition: mountedRef.current ? 'width 1s linear' : 'none',
            }}
          />
        </div>
        <span className="active-exp-pct">{pct}%</span>
      </div>

      {canCollect && (
        <>
          <button className="collect-btn" onClick={handleCollect} disabled={collecting}>
            <PackageOpen size={16} strokeWidth={2} />
            {collecting ? 'Recogiendo...' : 'Recoger recompensas'}
          </button>
          {collectError && <p className="collect-error">{collectError}</p>}
        </>
      )}
    </div>
  )
}

function DungeonCard({ dungeon, heroLevel, heroStatus, heroId, onStart }) {
  const [loading, setLoading] = useState(false)
  const name = dungeon.name
  const description = dungeon.description
  const locked = heroLevel < dungeon.min_hero_level
  const busy = heroStatus !== 'idle'
  const disabled = locked || busy || loading

  async function handleStart() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/expedition-start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ dungeonId: dungeon.id, heroId }),
    })
    const data = await res.json()
    if (res.ok) onStart(data)
    else setLoading(false)
  }

  return (
    <div className={`dungeon-card ${locked ? 'dungeon-card--locked' : ''}`}>
      <div className="dungeon-card-top">
        <div className="dungeon-main">
          <h3 className="dungeon-name">{name}</h3>
          <p className="dungeon-desc">{description}</p>
          <div className="dungeon-meta">
            <span className="dungeon-meta-item">
              <Clock size={13} strokeWidth={2} />
              {dungeon.duration_minutes} min
            </span>
            <span className="dungeon-meta-item">
              <Star size={13} strokeWidth={2} />
              Nv. {dungeon.min_hero_level}+
            </span>
          </div>
        </div>
        <div className="dungeon-difficulty">
          <span className="dungeon-difficulty-label">Dificultad</span>
          <DifficultyDots value={dungeon.difficulty} />
        </div>
      </div>

      <div className="dungeon-card-bottom">
        <div className="dungeon-rewards">
          <span className="reward-item"><Coins size={13} strokeWidth={2} color="#d97706" />{fmt(dungeon.gold_min)}–{fmt(dungeon.gold_max)}</span>
          <span className="reward-item"><Axe size={13} strokeWidth={2} color="#16a34a" />{fmt(dungeon.wood_min)}–{fmt(dungeon.wood_max)}</span>
          <span className="reward-item"><Sparkles size={13} strokeWidth={2} color="#7c3aed" />{fmt(dungeon.mana_min)}–{fmt(dungeon.mana_max)}</span>
          <span className="reward-item"><Swords size={13} strokeWidth={2} color="#0369a1" />{dungeon.experience_reward} XP</span>
        </div>
        <button className="explore-btn" onClick={handleStart} disabled={disabled}>
          {locked
            ? `Nv. ${dungeon.min_hero_level} requerido`
            : busy
              ? 'Héroe ocupado'
              : loading
                ? 'Enviando...'
                : <><span>Explorar</span><ChevronRight size={15} strokeWidth={2} /></>
          }
        </button>
      </div>
    </div>
  )
}

function Dungeons({ userId, heroId }) {
  const { hero, loading: heroLoading, refetch: refetchHero } = useHero(heroId)
  const { dungeons, loading: dungeonsLoading } = useDungeons()
  const { expedition, loading: expLoading, setExpedition, refetch } = useActiveExpedition(hero?.id)
  const [reward, setReward] = useState(null)

  // Mantener pantalla encendida mientras hay expedición en curso
  useWakeLock(!!expedition)

  // Fix 2: sin reload — refetch la expedición tras iniciarla
  async function handleStart() {
    await refetch()
  }

  function handleCollect(data) {
    setReward(data.rewards)
    setExpedition(null)
    refetchHero()
  }

  if (heroLoading || dungeonsLoading || expLoading) {
    return <div className="dungeons-loading">Cargando mazmorras...</div>
  }

  const heroStatus = expedition ? 'exploring' : (hero?.status ?? 'idle')

  return (
    <div className="dungeons-section">
      <div className="section-header">
        <h2 className="section-title">Mazmorras</h2>
        <p className="section-subtitle">Envía a tu héroe a explorar para conseguir recursos y experiencia.</p>
      </div>

      {expedition && (
        <ActiveExpedition expedition={expedition} onCollect={handleCollect} />
      )}

      {reward && (
        <div className="reward-toast">
          <p className="reward-toast-title">Recompensas recogidas</p>
          <div className="reward-toast-items">
            <span><Coins size={13} color="#d97706" />{reward.gold} oro</span>
            <span><Axe size={13} color="#16a34a" />{reward.wood} madera</span>
            <span><Sparkles size={13} color="#7c3aed" />{reward.mana} maná</span>
            <span><Swords size={13} color="#0369a1" />{reward.experience} XP</span>
          </div>
        </div>
      )}

      <div className="dungeons-grid">
        {dungeons?.map(dungeon => (
          <DungeonCard
            key={dungeon.id}
            dungeon={dungeon}
            heroLevel={hero?.level ?? 1}
            heroStatus={heroStatus}
            heroId={hero?.id}
            onStart={handleStart}
          />
        ))}
      </div>
    </div>
  )
}

export default Dungeons
