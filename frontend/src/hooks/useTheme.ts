import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'sonicai_theme'

function getSystemDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && getSystemDark())
  document.documentElement.classList.toggle('dark', isDark)
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system'
  })

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    media.addEventListener?.('change', handler)
    return () => media.removeEventListener?.('change', handler)
  }, [theme])

  const setTheme = (mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, mode)
    setThemeState(mode)
    applyTheme(mode)
  }

  return { theme, setTheme }
}
