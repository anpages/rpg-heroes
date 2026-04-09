import { ZONES } from './constants.js'

export default function ZonePills({ active, onChange }) {
  return (
    <div className="flex items-stretch gap-1 border-b border-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ZONES.map(z => {
        const Icon = z.icon
        const isActive = active === z.id
        return (
          <button
            key={z.id}
            onClick={() => onChange(z.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap transition-[color,border-color] duration-150 bg-transparent border-x-0 border-t-0 font-[inherit] ${
              isActive
                ? 'border-b-[var(--blue-600)] text-[var(--blue-700)]'
                : 'border-b-transparent text-text-3 hover:text-text'
            }`}
          >
            <Icon size={14} strokeWidth={2} />
            {z.label}
          </button>
        )
      })}
    </div>
  )
}
