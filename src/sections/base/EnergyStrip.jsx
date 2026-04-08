import { Zap } from 'lucide-react'
import { RESOURCE_ITEMS } from './constants.js'
import { fmt } from './helpers.js'

export function EnergyStrip({ nexusData }) {
  if (!nexusData) return null
  const { produced, consumed, balance, deficit, barPct, efficiency } = nexusData
  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 ${
      deficit
        ? 'border-[color-mix(in_srgb,#dc2626_30%,var(--border))] bg-[color-mix(in_srgb,#dc2626_5%,var(--surface))]'
        : 'border-border bg-surface'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Zap size={13} strokeWidth={2} color="#0891b2" />
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-3">Energía</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-text-2">
            <span className="text-[#0891b2] font-bold">{produced}</span> producida
          </span>
          <span className="text-border">·</span>
          <span className="text-[12px] font-semibold text-text-2">
            <span className="font-bold text-text">{consumed}</span> consumida
          </span>
          <span className="text-border">·</span>
          <span className={`text-[12px] font-bold ${deficit ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
            {deficit ? `−${Math.abs(balance)} déficit` : `+${balance} excedente`}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-[400ms] ${deficit ? 'bg-[#dc2626]' : 'bg-[#0891b2]'}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      {deficit && (
        <p className="text-[11px] text-[#dc2626] font-semibold">
          Producción reducida al {efficiency}% — mejora el Nexo Arcano para recuperar rendimiento
        </p>
      )}
    </div>
  )
}

export function ResourcesHeader({ resources }) {
  if (!resources) return null

  return (
    <div className="grid grid-cols-3 gap-0 rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)] overflow-hidden">
      {RESOURCE_ITEMS.map((item, idx) => {
        const Icon  = item.icon
        const value = resources[item.key] ?? 0
        const isLast = idx === RESOURCE_ITEMS.length - 1

        return (
          <div
            key={item.key}
            className={`flex flex-col items-center justify-center gap-1.5 py-5 px-3 relative ${!isLast ? 'border-r border-border' : ''}`}
          >
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%,${item.color} 0%,transparent 70%)` }}
            />
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `color-mix(in srgb,${item.color} 14%,var(--surface-2))` }}
            >
              <Icon size={17} strokeWidth={2} style={{ color: item.color }} />
            </div>
            <p className="text-[26px] font-extrabold text-text leading-none tabular-nums">
              {fmt(value)}
            </p>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] font-semibold text-text-3">{item.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
