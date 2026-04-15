import { Castle, Coins, Sparkles, Droplets, Axe, Pickaxe, Sprout } from 'lucide-react'
import { fmt, baseLevelFromMap, getBaseTier } from './helpers.js'

const BASIC_RESOURCES = [
  { key: 'wood',  Icon: Axe,      color: '#16a34a', label: 'Madera',  short: 'Mad'  },
  { key: 'iron',  Icon: Pickaxe,  color: '#64748b', label: 'Hierro',  short: 'Hier' },
  { key: 'herbs', Icon: Sprout,   color: '#15803d', label: 'Hierbas', short: 'Herb' },
  { key: 'mana',  Icon: Sparkles, color: '#7c3aed', label: 'Maná',    short: 'Maná' },
]

export default function BaseHeader({ byType, resources, trainingRooms }) {
  const baseLevel = baseLevelFromMap(byType, trainingRooms)
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

      {/* Badge nivel — esquina superior derecha */}
      <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-lg"
        style={{ background: `color-mix(in srgb, ${tier.color} 18%, var(--surface))`, border: `1px solid color-mix(in srgb, ${tier.color} 30%, var(--border))` }}>
        <Castle size={11} strokeWidth={2.5} style={{ color: tier.color }} />
        <span className="text-[12px] font-bold" style={{ color: tier.color }}>Nv. {baseLevel}</span>
      </div>

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
        <p className="text-[13px] text-text-3 leading-snug mb-2.5">{tier.subtitle}</p>

        {/* Oro · Fragmentos · Esencia */}
        {resources && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2">
              <Coins size={11} strokeWidth={2} color="#d97706" />
              <span className="tabular-nums">{fmt(resources.gold ?? 0)}</span>
              <span className="text-[10px] text-text-3">oro</span>
            </span>
            <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2">
              <Sparkles size={11} strokeWidth={2} color="#f59e0b" />
              <span className="tabular-nums">{fmt(resources.fragments ?? 0)}</span>
              <span className="text-[10px] text-text-3">frag.</span>
            </span>
            <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2">
              <Droplets size={11} strokeWidth={2} color="#8b5cf6" />
              <span className="tabular-nums">{fmt(resources.essence ?? 0)}</span>
              <span className="text-[10px] text-text-3">esen.</span>
            </span>
          </div>
        )}
      </div>

      {/* Footer: 4 recursos básicos */}
      {resources && (
        <div
          className="border-t grid grid-cols-4 bg-surface-2"
          style={{ borderColor: `color-mix(in srgb, ${tier.color} 20%, var(--border))` }}
        >
          {BASIC_RESOURCES.map(({ key, Icon, color, label, short }, idx, arr) => (
            <div
              key={key}
              className={`flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:py-3 relative ${idx < arr.length - 1 ? 'border-r' : ''}`}
              style={{ borderColor: `color-mix(in srgb, ${tier.color} 15%, var(--border))` }}
            >
              <div
                className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb,${color} 14%,transparent)` }}
              >
                <Icon size={11} strokeWidth={2} style={{ color }} className="sm:hidden" />
                <Icon size={14} strokeWidth={2} style={{ color }} className="hidden sm:block" />
              </div>
              <p className="text-[13px] sm:text-[18px] font-extrabold text-text leading-none tabular-nums">
                {fmt(resources[key] ?? 0)}
              </p>
              <span className="text-[8px] sm:text-[9px] font-semibold text-text-3 uppercase tracking-wide leading-none">
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
