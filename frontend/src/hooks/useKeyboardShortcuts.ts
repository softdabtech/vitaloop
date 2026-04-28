import { useEffect } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  callback: () => void
  description: string
}

const shortcuts: Shortcut[] = [
  {
    key: 'k',
    ctrl: true,
    callback: () => {
      const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement
      if (searchInput) searchInput.focus()
    },
    description: 'Focus search',
  },
  {
    key: 'u',
    ctrl: true,
    callback: () => {
      const uploadBtn = document.querySelector('[data-upload-button]') as HTMLButtonElement
      if (uploadBtn) uploadBtn.click()
    },
    description: 'Start upload',
  },
  {
    key: 'd',
    ctrl: true,
    shift: true,
    callback: () => {
      document.documentElement.setAttribute('data-theme',
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
      )
    },
    description: 'Toggle dark mode',
  },
]

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      shortcuts.forEach(shortcut => {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          e.preventDefault()
          shortcut.callback()
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return shortcuts
}
