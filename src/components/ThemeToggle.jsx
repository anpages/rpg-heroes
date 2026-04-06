import { Sun, Moon, Monitor } from 'lucide-react'

const OPTIONS = [
  { value: 'light', icon: Sun,     label: 'Claro' },
  { value: 'auto',  icon: Monitor, label: 'Auto' },
  { value: 'dark',  icon: Moon,    label: 'Oscuro' },
]

export default function ThemeToggle({ theme, setTheme }) {
  const current = OPTIONS.find(o => o.value === theme) ?? OPTIONS[1]
  const CurrentIcon = current.icon

  function cycle() {
    const idx = OPTIONS.findIndex(o => o.value === theme)
    setTheme(OPTIONS[(idx + 1) % OPTIONS.length].value)
  }

  return (
    <>
      {/* Desktop: 3 opciones visibles */}
      <div className="hidden md:flex items-center bg-surface-2 border border-border rounded-lg p-0.5 gap-px" role="group" aria-label="Tema de color">
        {OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            className={`flex items-center justify-center w-7 h-[26px] rounded-md border-0 cursor-pointer transition-[background,color] duration-150 ${
              theme === value
                ? 'bg-surface text-text shadow-[var(--shadow-sm)]'
                : 'bg-transparent text-text-3 hover:text-text-2 hover:bg-border'
            }`}
            onClick={() => setTheme(value)}
            title={label}
            aria-label={label}
            aria-pressed={theme === value}
          >
            <Icon size={14} strokeWidth={2} />
          </button>
        ))}
      </div>

      {/* Móvil: un solo botón que cicla */}
      <button
        className="flex md:hidden items-center justify-center w-8 h-8 border border-border rounded-lg bg-surface-2 text-text-2 cursor-pointer transition-[background,color] duration-150 hover:bg-bg hover:text-text"
        onClick={cycle}
        title={current.label}
        aria-label={`Tema: ${current.label}`}
      >
        <CurrentIcon size={16} strokeWidth={2} />
      </button>
    </>
  )
}
