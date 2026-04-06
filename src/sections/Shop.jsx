import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { apiPost, apiGet } from '../lib/api'
import {
  Coins, Clock, CheckCircle2, PackageX, Lock,
  Sword, Shield, Gem, Dumbbell, Wind, Brain, Heart,
} from 'lucide-react'
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
  helmet:    'Casco',
  chest:     'Pecho',
  arms:      'Brazos',
  legs:      'Piernas',
  main_hand: 'Arma Principal',
  off_hand:  'Mano Secundaria',
  accessory: 'Complemento',
}

const MERCHANT_ICON = { weapons: Sword, armor: Shield, relics: Gem }

const STAT_META = [
  { key: 'attack_bonus',       label: 'Ataque',       Icon: Sword    },
  { key: 'defense_bonus',      label: 'Defensa',      Icon: Shield   },
  { key: 'hp_bonus',           label: 'HP',           Icon: Heart    },
  { key: 'strength_bonus',     label: 'Fuerza',       Icon: Dumbbell },
  { key: 'agility_bonus',      label: 'Agilidad',     Icon: Wind     },
  { key: 'intelligence_bonus', label: 'Inteligencia', Icon: Brain    },
]

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
  const stats = STAT_META.filter(s => item[s.key] > 0)
  const sold = item.purchased >= item.maxStock
  const canAfford = gold >= item.goldPrice

  return (
    <div
      className={`shop-item ${sold ? 'shop-item--sold' : ''} ${item.locked ? 'shop-item--locked' : ''}`}
      style={{ '--rarity-color': rarity.color }}
    >
      {/* Accent bar */}
      <div className="shop-item-accent" />

      <div className="shop-item-body">
        {/* Header */}
        <div className="shop-item-header">
          <span className="shop-item-name" style={{ color: rarity.color }}>
            {item.name}
          </span>
          <div className="shop-item-badges">
            <span className="shop-item-tier">T{item.tier}</span>
            <span className="shop-item-rarity" style={{ color: rarity.color }}>
              {rarity.label}
            </span>
          </div>
        </div>

        {/* Slot */}
        <span className="shop-item-slot">
          {SLOT_LABEL[item.slot] ?? item.slot}
          {item.is_two_handed && <span className="shop-item-2h"> · 2 manos</span>}
        </span>

        {/* Stats */}
        {stats.length > 0 ? (
          <ul className="shop-item-stats">
            {stats.map(({ key, label, Icon }) => (
              <li key={key} className="shop-item-stat">
                <Icon size={12} strokeWidth={2} className="shop-stat-icon" />
                <span className="shop-stat-label">{label}</span>
                <span className="shop-stat-value">+{item[key]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="shop-item-no-stats">Sin bonificaciones</p>
        )}

        {/* Footer */}
        <div className="shop-item-footer">
          {item.locked ? (
            <div className="shop-item-lock-row">
              <Lock size={14} strokeWidth={2} />
              <span>Requiere nivel {item.minLevel}</span>
            </div>
          ) : sold ? (
            <div className="shop-item-sold-row">
              <CheckCircle2 size={14} strokeWidth={2} />
              <span>Comprado</span>
            </div>
          ) : (
            <>
              <span className={`shop-item-price ${!canAfford ? 'shop-item-price--short' : ''}`}>
                <Coins size={14} strokeWidth={2} />
                {item.goldPrice.toLocaleString('es-ES')}
              </span>
              <button
                className="btn btn--primary btn--sm"
                disabled={!canAfford || buying}
                onClick={() => onBuy(item)}
                title={!canAfford ? 'Oro insuficiente' : undefined}
              >
                Comprar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Shop({ userId, heroId, heroName, gold, onResourceChange }) {
  const queryClient = useQueryClient()
  const shopKey = ['shop', heroId]
  const [toast, setToast]       = useState(null)
  const [renewsIn, setRenewsIn] = useState(timeUntilMidnight())

  useEffect(() => {
    const t = setInterval(() => setRenewsIn(timeUntilMidnight()), 60000)
    return () => clearInterval(t)
  }, [])

  // Tienda — cacheada, se refresca automáticamente al volver al tab
  const { data: shopData, isLoading: loading, error: shopError } = useQuery({
    queryKey: shopKey,
    queryFn: () => apiGet(`/api/shop-daily?heroId=${heroId}`),
    enabled: !!heroId,
    staleTime: 30 * 60_000, // 30 min — la tienda rota a medianoche
  })
  const items    = shopData?.items ?? null
  const merchant = shopData?.merchant ?? null
  const error    = shopError?.message ?? null

  // Compra con optimistic update
  const buyMutation = useMutation({
    mutationFn: (item) => apiPost('/api/shop-buy', { heroId, catalogId: item.catalogId }),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: shopKey })
      const previous = queryClient.getQueryData(shopKey)
      queryClient.setQueryData(shopKey, (old) => ({
        ...old,
        items: old?.items?.map(i =>
          i.catalogId === item.catalogId ? { ...i, purchased: i.purchased + 1 } : i
        ),
      }))
      return { previous, item }
    },
    onError: (err, item, context) => {
      queryClient.setQueryData(shopKey, context.previous)
      showToast(err.message, 'err')
    },
    onSuccess: (data, item) => {
      showToast(`${item.name} añadido al inventario`, 'ok')
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      onResourceChange?.()
    },
  })

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
        <div className="shop-header-left">
          <div className="shop-header-title">
            <MerchantIcon size={20} strokeWidth={1.8} />
            <span>{merchant ? `${merchant.label}` : 'Tienda'}</span>
          </div>
          {heroName && (
            <span className="shop-header-sub">Inventario de {heroName}</span>
          )}
        </div>
        <div className="shop-renews">
          <Clock size={13} strokeWidth={2} />
          Renueva en {renewsIn}
        </div>
      </div>

      {error && <p className="shop-error">{error}</p>}

      {loading ? (
        <div className="shop-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="shop-item-skeleton" />
          ))}
        </div>
      ) : items && (
        <div className="shop-grid">
          {items.map(item => (
            <ShopItem
              key={item.catalogId}
              item={item}
              gold={gold ?? 0}
              onBuy={(item) => buyMutation.mutate(item)}
              buying={buyMutation.isPending}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`shop-toast shop-toast--${toast.type}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
