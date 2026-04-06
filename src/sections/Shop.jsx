import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useResources } from '../hooks/useResources'
import { useHero } from '../hooks/useHero'
import { queryKeys } from '../lib/queryKeys'
import { apiPost, apiGet } from '../lib/api'
import { HeroSelector } from '../components/HeroPicker'
import {
  Coins, Clock, CheckCircle2, PackageX, Lock,
  Sword, Shield, Gem, Dumbbell, Wind, Brain, Heart,
} from 'lucide-react'

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
  const rarity    = RARITY_META[item.rarity] ?? RARITY_META.common
  const stats     = STAT_META.filter(s => item[s.key] > 0)
  const sold      = item.purchased >= item.maxStock
  const canAfford = gold >= item.goldPrice

  return (
    <div
      className={`flex overflow-hidden bg-surface border border-border rounded-xl shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-[180ms]
        ${sold ? 'opacity-60' : item.locked ? 'opacity-50 grayscale-[0.3]' : 'hover:shadow-[var(--shadow-md)] hover:border-[color-mix(in_srgb,var(--rarity-color)_40%,var(--border))]'}`}
      style={{ '--rarity-color': rarity.color }}
    >
      {/* Accent bar */}
      <div className="w-1 flex-shrink-0 opacity-75" style={{ background: rarity.color }} />

      <div className="flex-1 px-4 py-3.5 flex flex-col gap-2.5 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14px] font-bold leading-[1.3] flex-1 min-w-0" style={{ color: rarity.color }}>
            {item.name}
          </span>
          <div className="flex flex-col items-end gap-[3px] flex-shrink-0">
            <span className="text-[10px] font-bold text-text-3 bg-surface-2 border border-border rounded-[4px] px-[5px] py-px">
              T{item.tier}
            </span>
            <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: rarity.color }}>
              {rarity.label}
            </span>
          </div>
        </div>

        {/* Slot */}
        <span className="self-start text-[11px] font-semibold text-text-2 bg-surface-2 border border-border rounded-full px-[9px] py-0.5">
          {SLOT_LABEL[item.slot] ?? item.slot}
          {item.is_two_handed && <span className="font-normal text-text-3"> · 2 manos</span>}
        </span>

        {/* Stats */}
        {stats.length > 0 ? (
          <ul className="flex flex-col gap-[5px] flex-1">
            {stats.map(({ key, label, Icon }) => (
              <li key={key} className="flex items-center gap-1.5 text-[12px]">
                <Icon size={12} strokeWidth={2} className="text-text-3 flex-shrink-0" />
                <span className="text-text-2 flex-1">{label}</span>
                <span className="font-bold text-text">+{item[key]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-text-3 flex-1">Sin bonificaciones</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border mt-auto">
          {item.locked ? (
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3 w-full justify-center">
              <Lock size={14} strokeWidth={2} />
              <span>Requiere nivel {item.minLevel}</span>
            </div>
          ) : sold ? (
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16a34a] dark:text-[#4ade80] w-full justify-center">
              <CheckCircle2 size={14} strokeWidth={2} />
              <span>Comprado</span>
            </div>
          ) : (
            <>
              <span className={`flex items-center gap-[5px] text-[15px] font-extrabold ${!canAfford ? 'text-error-text opacity-80' : 'text-text'}`}>
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

export default function Shop() {
  const userId      = useAppStore(s => s.userId)
  const heroId      = useHeroId()
  const queryClient = useQueryClient()
  const shopKey     = queryKeys.shop(heroId)
  const { hero }    = useHero(heroId)
  const { resources } = useResources(userId)
  const heroName    = hero?.name
  const gold        = resources?.gold
  const [renewsIn, setRenewsIn] = useState(timeUntilMidnight())

  useEffect(() => {
    const t = setInterval(() => setRenewsIn(timeUntilMidnight()), 60000)
    return () => clearInterval(t)
  }, [])

  const { data: shopData, isLoading: loading, error: shopError } = useQuery({
    queryKey: shopKey,
    queryFn: () => apiGet(`/api/shop-daily?heroId=${heroId}`),
    enabled: !!heroId,
    staleTime: 30 * 60_000,
  })
  const items    = shopData?.items ?? null
  const merchant = shopData?.merchant ?? null
  const error    = shopError?.message ?? null

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
    onError: (err, _item, context) => {
      queryClient.setQueryData(shopKey, context.previous)
      toast.error(err.message)
    },
    onSuccess: (_data, item) => {
      toast.success(`${item.name} añadido al inventario`)
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
  })

  if (!heroId) return (
    <div className="flex flex-col items-center gap-3 py-16 px-6 text-text-3 text-[14px]">
      <PackageX size={36} strokeWidth={1.5} />
      <p>Selecciona un héroe para ver su tienda</p>
    </div>
  )

  const MerchantIcon = merchant ? (MERCHANT_ICON[merchant.key] ?? Sword) : Sword

  return (
    <div className="flex flex-col gap-6 relative">
      <HeroSelector />
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 font-display tracking-[0.05em] text-[20px] font-bold text-text">
            <MerchantIcon size={20} strokeWidth={1.8} />
            <span>{merchant ? merchant.label : 'Tienda'}</span>
          </div>
          {heroName && (
            <span className="text-[12px] text-text-3 font-medium pl-0.5">Inventario de {heroName}</span>
          )}
        </div>
        <div className="flex items-center gap-[5px] text-[12px] font-medium text-text-3 whitespace-nowrap">
          <Clock size={13} strokeWidth={2} />
          Renueva en {renewsIn}
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-error-text bg-error-bg border border-error-border rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-[200px] sm:h-[180px] rounded-xl bg-surface-2 animate-skeleton-pulse" />
          ))}
        </div>
      ) : items && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {items.map(item => (
            <ShopItem
              key={item.catalogId}
              item={item}
              gold={gold ?? 0}
              onBuy={(i) => buyMutation.mutate(i)}
              buying={buyMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
