import { ZONES } from './constants.js'
import ScrollHint from '../../components/ScrollHint'

export default function ZonePills({ active, onChange, badges = {} }) {
  return (
    <div className="border-b border-border">
      <ScrollHint>
      {ZONES.map(z => {
        const Icon = z.icon
        const isActive = active === z.id
        const badge = badges[z.id] ?? 0
        return (
          <button
            key={z.id}
            onClick={() => onChange(z.id)}
            className="relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 border-x-0 border-t-0 transition-[color,border-color] duration-150 bg-transparent font-[inherit]"
            style={{
              borderBottomColor: isActive ? '#2563eb' : 'transparent',
              color: isActive ? '#2563eb' : 'var(--text-3)',
            }}
          >
            <Icon size={14} strokeWidth={2} />
            {z.label}
            {badge > 0 && (
              <span className="min-w-[16px] h-[16px] flex items-center justify-center px-1 rounded-full text-[10px] font-bold text-white bg-[#16a34a] leading-none">
                {badge}
              </span>
            )}
          </button>
        )
      })}
      </ScrollHint>
    </div>
  )
}
