import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Coins, Clock, CheckCircle2, PackageX, Lock, Sword, Shield, Gem } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './Shop.css'

const RARITY_META = {
  common:    { label: 'Común',      color: '#6b7280' },
  uncommon:  { label: 'Poco Común', color: '#16a34a' },
  rare:      { label: 'Raro',       color: '#2563eb' },
  epic:      { label: 'Épico',      color: '#7c3aed' },
  legendary: { label: 'Legendario', color: '#d97706' },
}

const SLOT_LABEL = {
  helmet: 'Casco', chest: 'Pecho', arms: 'Brazos', legs: 'Piernas',
  feet: 'Pies', main_hand: 'Mano Ppal.', off_hand: 'Mano Sec.', accessory: 'Accesorio',
}

const MERCHANT_ICON = { weapons: Sword, armor: Shield, relics: Gem }

function statLines(item) {
  return [
    item.attack_bonus       > 0 && `+${item.attack_bonus} Atq`,
    item.defense_bonus      > 0 && `+${item.defense_bonus} Def`,
    item.hp_bonus           > 0 && `+${item.hp_bonus} HP`,
    item.strength_bonus     > 0 && `+${item.strength_bonus} Fue`,
    item.agility_bonus      > 0 && `+${item.agility_bonus} Agi`,
    item.intelligence_bonus > 0 && `+${item.intelligence_bonus} Int`,
  ].filter(Boolean)
}

function timeUntilMidnight() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  const diff = midnight - now
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m`
}

function ShopItem({ item, gold, onBuy, buying }) {
  const rarity = RARITY_META[item.rarity] ?? RARITY_META.common
  const stats = statLines(item)
  const sold = item.purchased >= item.maxStock
  const canAfford = gold >= item.goldPrice

  return (
    <div
      className={`shop-item ${sold ? 'shop-item--sold' : ''} ${item.locked ? 'shop-item--locked' : ''}`}
      style={{ '--rarity-color': rarity.color }}
    >
      <div className="shop-item-header">
        <span className="shop-item-name" style={{ color: item.locked ? undefined : rarity.color }}>
          {item.name}
        </span>
        <span className="shop-item-rarity">{rarity.label}</span>
      </div>

      <div className="shop-item-meta">
        <span className="shop-item-slot">{SLOT_LABEL[item.slot] ?? item.slot}</span>
        <span className="shop-item-tier">T{item.tier}</span>
      </div>

      {stats.length > 0 && (
        <ul className="shop-item-stats">
          {stats.map(s => <li key={s}>{s}</li>)}
        </ul>
      )}

      <div className="shop-item-footer">
        {item.locked ? (
          <span className="shop-item-locked-label">
            <Lock size={12} strokeWidth={2} /> Nv. {item.minLevel}
          </span>
        ) : sold ? (
          <span className="shop-item-sold-label">
            <CheckCircle2 size={13} strokeWidth={2} /> Comprado
          </span>
        ) : (
          <button
            className="btn btn--primary btn--sm"
            disabled={!canAfford || buying}
            onClick={() => onBuy(item)}
            title={!canAfford ? 'Oro insuficiente' : undefined}
          >
            <Coins size={13} strokeWidth={2} />
            {item.goldPrice.toLocaleString('es-ES')}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Shop({ userId, heroId, heroName, gold, onResourceChange }) {
  const [items, setItems]       = useState(null)
  const [merchant, setMerchant] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [buying, setBuying]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [renewsIn, setRenewsIn] = useState(timeUntilMidnight())

  useEffect(() => {
    if (!heroId) return
    loadShop()
  }, [heroId])

  useEffect(() => {
    const t = setInterval(() => setRenewsIn(timeUntilMidnight()), 60000)
    return () => clearInterval(t)
  }, [])

  async function loadShop() {
    setLoading(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch(`/api/shop-daily?heroId=${heroId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Error al cargar la tienda')
      const data = await res.json()
      setItems(data.items)
      setMerchant(data.merchant)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleBuy(item) {
    setBuying(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/shop-buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ heroId, catalogId: item.catalogId }),
    })
    const data = await res.json()
    setBuying(false)

    if (res.ok) {
      setItems(prev => prev.map(i =>
        i.catalogId === item.catalogId ? { ...i, purchased: i.purchased + 1 } : i
      ))
      onResourceChange?.()
      showToast(`${item.name} añadido al inventario`, 'ok')
    } else {
      showToast(data.error ?? 'Error al comprar', 'err')
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  if (!heroId) return (
    <div className="shop-empty">
      <PackageX size={36} strokeWidth={1.5} />
      <p>Selecciona un héroe para ver su tienda</p>
    </div>
  )

  const MerchantIcon = merchant ? (MERCHANT_ICON[merchant.key] ?? Sword) : Sword

  return (
    <div className="shop-section">
      <div className="shop-header">
        <div className="shop-header-title">
          <MerchantIcon size={18} strokeWidth={1.8} />
          <span>{merchant ? `${merchant.label} de ${heroName ?? 'Héroe'}` : 'Tienda'}</span>
        </div>
        <div className="shop-renews">
          <Clock size={13} strokeWidth={2} />
          Renueva en {renewsIn}
        </div>
      </div>

      {loading && (
        <div className="shop-loading">
          {[...Array(8)].map((_, i) => <div key={i} className="shop-item-skeleton" />)}
        </div>
      )}

      {error && <p className="shop-error">{error}</p>}

      {!loading && !error && items && (
        <div className="shop-grid">
          {items.map(item => (
            <ShopItem
              key={item.catalogId}
              item={item}
              gold={gold ?? 0}
              onBuy={handleBuy}
              buying={buying}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`shop-toast shop-toast--${toast.type}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
