/**
 * Panel de pociones de combate (ATQ/DEF boost).
 * Se usa en Torre y Torneos, antes del botón de combatir.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Swords, ShieldCheck, FlaskConical } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePotions } from '../hooks/usePotions'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'

const BOOST_META = {
  atk_boost: { label: 'ATQ +%', icon: Swords,      color: '#0369a1' },
  def_boost: { label: 'DEF +%', icon: ShieldCheck,  color: '#16a34a' },
}

export function PotionPanel({ heroId, activeEffects = {} }) {
  const queryClient = useQueryClient()
  const { potions } = usePotions(heroId)

  const useMut = useMutation({
    mutationFn: (potionId) => apiPost('/api/potion-use', { heroId, potionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.potions(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      toast.success('¡Poción activada!')
    },
    onError: err => toast.error(err.message),
  })

  const combatPotions = potions.filter(p =>
    (p.effect_type === 'atk_boost' || p.effect_type === 'def_boost') && p.quantity > 0
  )

  // Boosts ya activos
  const activeBoosts = Object.entries(activeEffects)
    .filter(([k]) => k === 'atk_boost' || k === 'def_boost')

  if (combatPotions.length === 0 && activeBoosts.length === 0) return null

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
      <div className="flex items-center gap-1.5">
        <FlaskConical size={12} strokeWidth={2} className="text-text-3" />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Pociones</span>
        {activeBoosts.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            {activeBoosts.map(([k, v]) => {
              const meta = BOOST_META[k]
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
                  +{Math.round(v * 100)}% activo
                </span>
              )
            })}
          </div>
        )}
      </div>

      {combatPotions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {combatPotions.map(p => {
            const meta    = BOOST_META[p.effect_type]
            const Icon    = meta.icon
            const alreadyActive = !!activeEffects[p.effect_type]
            const empty   = p.quantity <= 0
            const disabled = alreadyActive || empty || useMut.isPending

            return (
              <motion.button
                key={p.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-[opacity] duration-150 disabled:opacity-40"
                style={{
                  color:       alreadyActive ? meta.color : 'var(--text-2)',
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
                <Icon size={11} strokeWidth={2.5} style={{ color: meta.color }} />
                {p.name}
                <span className="opacity-60">×{p.quantity}</span>
                {alreadyActive && <span className="text-[10px]">✓</span>}
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
