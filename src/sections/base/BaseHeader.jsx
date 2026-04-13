import { Castle, Coins, Sparkles, Droplets } from 'lucide-react'
import { fmt, baseLevelFromMap, getBaseTier } from './helpers.js'

const FOOTER_ITEMS = [
  { key: 'level',     Icon: Castle,   color: null,      label: 'Nivel',      short: 'Nv'   },
  { key: 'gold',      Icon: Coins,    color: '#d97706', label: 'Oro',        short: 'Oro'  },
  { key: 'fragments', Icon: Sparkles, color: '#f59e0b', label: 'Fragmentos', short: 'Frag' },
  { key: 'essence',   Icon: Droplets, color: '#8b5cf6', label: 'Esencia',    short: 'Esen' },
]

export default function BaseHeader({ byType, resources }) {
  const baseLevel = baseLevelFromMap(byType)
  const tier      = getBaseTier(baseLevel)

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        background:  `linear-gradient(135deg, color-mix(in srgb, ${tier.color} 16%, var(--surface)) 0%, var(--surface) 60%)`,
        borderColor: `color-mix(in srgb, ${tier.color} 28%, var(--border))`,
      }}
    >
      {/* accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: tier.color }} />

      {/* Título */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Castle size={12} strokeWidth={2.5} style={{ color: tier.color }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: tier.color }}>
            Tu Base
          </span>
        </div>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 38,
          lineHeight: 1,
          letterSpacing: '0.04em',
          color: 'var(--text)',
          marginBottom: 4,
        }}>
          {tier.name}
        </h1>
        <p className="text-[13px] text-text-3 leading-snug">{tier.subtitle}</p>
      </div>

      {/* Footer: nivel + oro + fragmentos + esencia */}
      {resources && (
        <div
          className="border-t grid grid-cols-4 bg-surface-2"
          style={{ borderColor: `color-mix(in srgb, ${tier.color} 20%, var(--border))` }}
        >
          {FOOTER_ITEMS.map(({ key, Icon, color, label, short }, idx, arr) => {
            const itemColor = color ?? tier.color
            const value = key === 'level' ? baseLevel : (resources[key] ?? 0)
            return (
              <div
                key={key}
                className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:py-3 relative ${idx < arr.length - 1 ? 'border-r' : ''}`}
                style={{ borderColor: `color-mix(in srgb, ${tier.color} 15%, var(--border))` }}
              >
                <div
                  className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center"
                  style={{ background: `color-mix(in srgb,${itemColor} 14%,transparent)` }}
                >
                  <Icon size={11} strokeWidth={2} style={{ color: itemColor }} className="sm:hidden" />
                  <Icon size={14} strokeWidth={2} style={{ color: itemColor }} className="hidden sm:block" />
                </div>
                <p className="text-[13px] sm:text-[18px] font-extrabold text-text leading-none tabular-nums">
                  {fmt(value)}
                </p>
                <span className="text-[8px] sm:text-[9px] font-semibold text-text-3 uppercase tracking-wide leading-none">
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
