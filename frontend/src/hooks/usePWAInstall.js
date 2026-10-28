import { useState, useEffect } from 'react'

/**
 * Hook that captures the native `beforeinstallprompt` event.
 * Returns { canInstall, install, dismissed, dismiss }.
 *
 * Works on Android Chrome / Edge. iOS Safari does not fire this event —
 * we detect iOS separately and show a manual "Add to Home Screen" tip.
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('pwa-install-dismissed') === '1' } catch { return false }
  })

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Hide banner once actually installed
  useEffect(() => {
    const handler = () => setDeferredPrompt(null)
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  function dismiss() {
    try { localStorage.setItem('pwa-install-dismissed', '1') } catch { /* noop */ }
    setDismissed(true)
  }

  // Detect standalone mode (already installed)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  // Detect iOS for manual tip
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  const canInstall = !isStandalone && !dismissed && (!!deferredPrompt || isIOS)

  return { canInstall, install, dismiss, isIOS, isStandalone }
}
