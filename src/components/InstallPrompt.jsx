import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // No mostrar si ya está instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return

    function handler(e) {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[min(92vw,400px)] animate-install-slide-up">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl shadow-[var(--shadow-lg)]">
        <div className="flex-1 flex flex-col gap-px min-w-0">
          <span className="text-[0.8rem] font-semibold text-text">Instalar RPG Heroes</span>
          <span className="text-[0.7rem] text-text-3">Accede más rápido desde tu pantalla de inicio</span>
        </div>
        <button
          onClick={install}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-btn-primary text-white border-0 rounded-lg text-[0.78rem] font-semibold cursor-pointer whitespace-nowrap flex-shrink-0 transition-[background] duration-150 hover:bg-btn-primary-hover"
        >
          <Download size={14} strokeWidth={2} />
          Instalar
        </button>
        <button
          onClick={() => setVisible(false)}
          aria-label="Cerrar"
          className="flex items-center justify-center w-6 h-6 bg-transparent border-0 text-text-3 cursor-pointer rounded-md flex-shrink-0 transition-[color] duration-150 hover:text-text"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
