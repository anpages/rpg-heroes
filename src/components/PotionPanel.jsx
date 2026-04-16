/**
 * Panel genérico de items consumibles antes de una actividad.
 * Lee del inventario unificado (player_crafted_items + crafting_catalog.effects).
 *
 * - Combate (Torre): effectTypes [atk_boost, def_boost]
 * - Expediciones: [hp_restore, xp_boost, time_reduction, loot_boost, gold_boost, hp_cost_reduction]
 * - Torre: [atk_boost, def_boost, tower_shield]
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import {
  Swords, ShieldCheck, FlaskConical,
  Clock, Package, Coins, Star, Sparkles, Heart, Shield, Zap, Droplets,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { describePotionEffect } from '../sections/base/constants'

const EFFECT_META = {
  hp_restore:        { icon: Heart,       color: '#dc2626', activeLabel: v => `+${Math.round(v * 100)}% HP activo` },
  atk_boost:         { icon: Swords,      color: '#0369a1', activeLabel: v => `+${Math.round(v * 100)}% ATQ activo` },
  def_boost:         { icon: ShieldCheck, color: '#16a34a', activeLabel: v => `+${Math.round(v * 100)}% DEF activo` },
  xp_boost:          { icon: Star,        color: '#0369a1', activeLabel: v => `+${Math.round(v * 100)}% XP activo` },
  time_reduction:    { icon: Clock,       color: '#0891b2', activeLabel: v => `−${Math.round(v * 100)}% tiempo activo` },
  loot_boost:        { icon: Package,     color: '#7c3aed', activeLabel: v => `+${Math.round(v * 100)}% botín activo` },
  gold_boost:        { icon: Coins,       color: '#d97706', activeLabel: v => `+${Math.round(v * 100)}% oro activo` },
  hp_cost_reduction: { icon: Heart,       color: '#059669', activeLabel: v => `−${Math.round(v * 100)}% coste HP activo` },
  tower_shield:      { icon: Shield,      color: '#64748b', activeLabel: v => `−${Math.round(v * 100)}% durabilidad activo` },
  crit_boost:        { icon: Zap,         color: '#f59e0b', activeLabel: v => `+${v} rondas crit activo` },
  armor_pen:         { icon: Swords,      color: '#dc2626', activeLabel: v => `+${Math.round(v * 100)}% penetración activo` },
  combat_shield:     { icon: Shield,      color: '#7c3aed', activeLabel: () => 'Escudo inicial activo' },
  lifesteal_pct:     { icon: Droplets,    color: '#be185d', activeLabel: v => `+${Math.round(v * 100)}% robo de vida activo` },
}

const DEFAULT_COMBAT_EFFECTS = ['atk_boost', 'def_boost']

export function PotionPanel({
  heroId,
  userId,
  activeEffects = {},
  effectTypes = DEFAULT_COMBAT_EFFECTS,
  title = 'Consumibles',
  isExploring = false,
}) {
  const queryClient = useQueryClient()
  const { catalog, inventory } = useCraftedItems(userId)

  const useMut = useMutation({
    mutationFn: (recipeId) => apiPost('/api/item-use', { heroId, recipeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
    onError: err => notify.error(err.message),
  })

  // Construir lista de items usables con effects que coincidan con effectTypes
  const allowed = new Set(effectTypes)
  const usableItems = (catalog ?? [])
    .filter(c => {
      if (!c.effects || c.effects.length === 0) return false
      if ((inventory[c.id] ?? 0) <= 0) return false
      return c.effects.some(e => allowed.has(e.type))
    })
    .map(c => ({
      ...c,
      quantity: inventory[c.id] ?? 0,
      primaryEffect: c.effects[0],
    }))

  const activeList = Object.entries(activeEffects).filter(([k]) => allowed.has(k))

  if (usableItems.length === 0 && activeList.length === 0) return null

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
      <div className="flex items-center gap-1.5">
        <FlaskConical size={12} strokeWidth={2} className="text-text-3" />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">{title}</span>
        {activeList.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            {activeList.map(([k, v]) => {
              const meta = EFFECT_META[k]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <span
                  key={k}
                  className="flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{
                    color: meta.color,
                    background: `color-mix(in srgb,${meta.color} 12%,var(--surface))`,
                  }}
                >
                  <Icon size={10} strokeWidth={2.5} />
                  {meta.activeLabel(v)}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {usableItems.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {usableItems.map(item => {
            const eff = item.primaryEffect
            const meta = EFFECT_META[eff.type]
            if (!meta) return null
            const Icon = meta.icon
            const alreadyActive = item.effects.some(e => !!activeEffects[e.type])
            const disabled = alreadyActive || useMut.isPending || isExploring

            const benefit = item.effects.map(e => describePotionEffect(e.type, e.value)).filter(Boolean).join(', ')
            return (
              <motion.button
                key={item.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-[opacity] duration-150 disabled:opacity-40"
                style={{
                  borderColor: alreadyActive
                    ? `color-mix(in srgb,${meta.color} 40%,var(--border))`
                    : 'var(--border)',
                  background: alreadyActive
                    ? `color-mix(in srgb,${meta.color} 8%,var(--surface))`
                    : 'var(--surface)',
                }}
                onClick={() => !disabled && useMut.mutate(item.id)}
                disabled={disabled}
                whileTap={disabled ? {} : { scale: 0.95 }}
              >
                <Icon size={13} strokeWidth={2.5} style={{ color: meta.color }} className="flex-shrink-0" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[12px] font-semibold" style={{ color: alreadyActive ? meta.color : 'var(--text-2)' }}>
                    {item.name}
                    <span className="opacity-60 ml-1">×{item.quantity}</span>
                    {alreadyActive && <span className="text-[10px] ml-1">✓</span>}
                  </span>
                  {benefit && (
                    <span className="text-[10px] font-bold" style={{ color: meta.color }}>
                      {benefit}
                    </span>
                  )}
                </span>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
