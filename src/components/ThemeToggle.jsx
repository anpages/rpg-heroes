import { Sun, Moon, Monitor } from 'lucide-react'
import './ThemeToggle.css'

const OPTIONS = [
  { value: 'light', icon: Sun,     label: 'Claro' },
  { value: 'auto',  icon: Monitor, label: 'Auto' },
  { value: 'dark',  icon: Moon,    label: 'Oscuro' },
]

export default function ThemeToggle({ theme, setTheme }) {
  return (
    <div className="theme-toggle" role="group" aria-label="Tema de color">
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
  )
}
