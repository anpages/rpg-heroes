import { ZONES } from './constants.js'

export default function ZonePills({ active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ boxShadow: 'inset 0 -1px 0 var(--border)' }}>
      {ZONES.map(z => {
        const Icon = z.icon
        const isActive = active === z.id
        return (
          <button
            key={z.id}
            onClick={() => onChange(z.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold whitespace-nowrap flex-shrink-0 transition-[color,box-shadow] duration-150 bg-transparent border-0 font-[inherit]"
            style={{
              color: isActive ? '#2563eb' : 'var(--text-3)',
              boxShadow: isActive ? 'inset 0 -2px 0 #2563eb' : 'none',
            }}
          >
            <Icon size={14} strokeWidth={2} />
            {z.label}
          </button>
        )
      })}
    </div>
  )
}
