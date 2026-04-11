/**
 * Panel genérico de pociones consumibles antes de una actividad.
 * Filtra por effectTypes y consume vía /api/potion-use.
 *
 * - Combate (Torre, Torneos, QuickCombat): por defecto [atk_boost, def_boost]
 * - Expediciones: [xp_boost, time_reduction, loot_boost, gold_boost, card_guaranteed]
 * - Cámaras:      [time_reduction, loot_boost]
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import {
  Swords, ShieldCheck, FlaskConical,
  Clock, Package, Coins, Star, Sparkles, Wrench,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { usePotions } from '../hooks/usePotions'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { describePotionEffect } from '../sections/base/constants'

// Metadata por tipo de efecto: icono, color y cómo renderizarlo cuando está activo.
const EFFECT_META = {
  atk_boost:       { icon: Swords,      color: '#0369a1', activeLabel: v => `+${Math.round(v * 100)}% ATQ activo` },
  def_boost:       { icon: ShieldCheck, color: '#16a34a', activeLabel: v => `+${Math.round(v * 100)}% DEF activo` },
  xp_boost:        { icon: Star,        color: '#0369a1', activeLabel: v => `+${Math.round(v * 100)}% XP activo` },
  time_reduction:  { icon: Clock,       color: '#0891b2', activeLabel: v => `−${Math.round(v * 100)}% tiempo activo` },
  loot_boost:      { icon: Package,     color: '#7c3aed', activeLabel: v => `+${Math.round(v * 100)}% botín activo` },
  gold_boost:      { icon: Coins,       color: '#d97706', activeLabel: v => `+${Math.round(v * 100)}% oro activo` },
  card_guaranteed: { icon: Sparkles,    color: '#2563eb', activeLabel: () => 'Carta garantizada' },
  free_repair:     { icon: Wrench,      color: '#64748b', activeLabel: () => 'Reparación gratis' },
}

const DEFAULT_COMBAT_EFFECTS = ['atk_boost', 'def_boost']

export function PotionPanel({
  heroId,
  userId,
  activeEffects = {},
  effectTypes = DEFAULT_COMBAT_EFFECTS,
  title = 'Pociones',
  isExploring = false,
}) {
  const queryClient = useQueryClient()
  const { potions } = usePotions(userId)

  const useMut = useMutation({
    mutationFn: (potionId) => apiPost('/api/potion-use', { heroId, potionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.potions(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
    onError: err => notify.error(err.message),
  })

  const allowed = new Set(effectTypes)
  const usablePotions = potions.filter(p => allowed.has(p.effect_type) && p.quantity > 0)
  const activeList = Object.entries(activeEffects).filter(([k]) => allowed.has(k))

  if (usablePotions.length === 0 && activeList.length === 0) return null

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

      {usablePotions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {usablePotions.map(p => {
            const meta = EFFECT_META[p.effect_type]
            if (!meta) return null
            const Icon = meta.icon
            const alreadyActive = !!activeEffects[p.effect_type]
            const disabled = alreadyActive || useMut.isPending || isExploring

            const benefit = describePotionEffect(p.effect_type, p.effect_value)
            return (
              <motion.button
                key={p.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-[opacity] duration-150 disabled:opacity-40"
                style={{
                  borderColor: alreadyActive
                    ? `color-mix(in srgb,${meta.color} 40%,var(--border))`
                    : 'var(--border)',
                  background: alreadyActive
                    ? `color-mix(in srgb,${meta.color} 8%,var(--surface))`
                    : 'var(--surface)',
                }}
                onClick={() => !disabled && useMut.mutate(p.id)}
                disabled={disabled}
                whileTap={disabled ? {} : { scale: 0.95 }}
              >
                <Icon size={13} strokeWidth={2.5} style={{ color: meta.color }} className="flex-shrink-0" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[12px] font-semibold" style={{ color: alreadyActive ? meta.color : 'var(--text-2)' }}>
                    {p.name}
                    <span className="opacity-60 ml-1">×{p.quantity}</span>
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
