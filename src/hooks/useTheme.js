import { useState, useEffect } from 'react'

const STORAGE_KEY = 'rpg-theme'

export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? 'auto'
  )

  useEffect(() => {
    function apply(t) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = t === 'dark' || (t === 'auto' && prefersDark)
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }

    apply(theme)
    localStorage.setItem(STORAGE_KEY, theme)

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', () => apply('auto'))
      return () => mq.removeEventListener('change', () => apply('auto'))
    }
  }, [theme])

  function setTheme(t) {
    setThemeState(t)
  }

  return { theme, setTheme }
}
