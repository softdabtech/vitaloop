import { useState, useCallback } from 'react'

const STORAGE_KEY = 'vl:tour_seen'

function readSeen() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function markSeen(pageKey) {
  try {
    const current = readSeen()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [pageKey]: true }))
  } catch { /* ignore */ }
}

export function useTourHints(pageKey) {
  const [dismissed, setDismissed] = useState(() => readSeen()[pageKey] === true)

  const dismiss = useCallback(() => {
    markSeen(pageKey)
    setDismissed(true)
  }, [pageKey])

  return { show: !dismissed, dismiss }
}
