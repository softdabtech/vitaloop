import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof localStorage === 'undefined') return false
    const saved = localStorage.getItem('vitaloop-dark-mode')
    if (saved !== null) return saved === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    localStorage.setItem('vitaloop-dark-mode', isDark.toString())
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')

    if (isDark) {
      document.documentElement.style.colorScheme = 'dark'
      document.documentElement.style.backgroundColor = '#0f172a'
    } else {
      document.documentElement.style.colorScheme = 'light'
      document.documentElement.style.backgroundColor = '#ffffff'
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark(!isDark) }
}
