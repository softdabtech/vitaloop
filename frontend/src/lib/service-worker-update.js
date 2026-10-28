export async function updateServiceWorker(registration) {
  if (!registration || typeof registration.update !== 'function') return false
  await registration.update()
  return true
}

export function startServiceWorkerUpdateCheck() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.ready
      .then(updateServiceWorker)
      .catch((error) => {
        console.warn('Service worker update check failed.', error)
      })
  }, { once: true })
}
