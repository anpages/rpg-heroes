import { Sun, Moon, Monitor } from 'lucide-react'
import './ThemeToggle.css'

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
      <div className="theme-toggle theme-toggle--desktop" role="group" aria-label="Tema de color">
        {OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            className={`theme-toggle-btn ${theme === value ? 'theme-toggle-btn--active' : ''}`}
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
        className="theme-toggle-cycle theme-toggle--mobile"
        onClick={cycle}
        title={current.label}
        aria-label={`Tema: ${current.label}`}
      >
        <CurrentIcon size={16} strokeWidth={2} />
      </button>
    </>
  )
}
