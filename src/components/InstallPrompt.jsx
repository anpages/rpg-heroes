import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import './InstallPrompt.css'

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
    <div className="install-prompt">
      <div className="install-prompt-inner">
        <div className="install-prompt-text">
          <span className="install-prompt-title">Instalar RPG Heroes</span>
          <span className="install-prompt-sub">Accede más rápido desde tu pantalla de inicio</span>
        </div>
        <button className="install-prompt-btn" onClick={install}>
          <Download size={14} strokeWidth={2} />
          Instalar
        </button>
        <button className="install-prompt-close" onClick={() => setVisible(false)} aria-label="Cerrar">
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
