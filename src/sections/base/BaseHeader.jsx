import { Castle, Coins } from 'lucide-react'
import { fmt, baseLevelFromMap, getBaseTier } from './helpers.js'
import { HEADER_RESOURCES } from './constants.js'

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

      {/* Título + badge */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
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

          {/* level badge + gold en fila */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <div
              className="flex flex-col items-center justify-center w-[52px] h-[52px] rounded-2xl border"
              style={{
                background:  `color-mix(in srgb, ${tier.color} 10%, var(--surface-2))`,
                borderColor: `color-mix(in srgb, ${tier.color} 30%, var(--border))`,
              }}
            >
              <span className="text-[22px] font-extrabold leading-none" style={{ color: tier.color }}>{baseLevel}</span>
              <span className="text-[9px] font-bold text-text-3 uppercase tracking-wide">nv.</span>
            </div>
            {resources && (
              <div
                className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-2xl border h-[52px] justify-center min-w-[56px]"
                style={{
                  background:  'color-mix(in srgb,#d97706 8%,var(--surface-2))',
                  borderColor: 'color-mix(in srgb,#d97706 25%,var(--border))',
                }}
              >
                <Coins size={13} strokeWidth={2} color="#d97706" />
                <span className="text-[14px] font-extrabold leading-none tabular-nums text-text">{fmt(resources.gold)}</span>
                <span className="text-[8px] font-bold text-text-3 uppercase tracking-wide">Oro</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resource grid */}
      {resources && (
        <div
          className="border-t grid grid-cols-5 bg-surface-2"
          style={{ borderColor: `color-mix(in srgb, ${tier.color} 20%, var(--border))` }}
        >
          {HEADER_RESOURCES.map(({ key, Icon, color, label, short }, idx, arr) => (
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
