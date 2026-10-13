export const NAVIGATION_CACHE_NAME = 'navigation-shell-v2'
export const LEGACY_CACHE_NAMES = new Set(['navigation-shell'])

export function obsoleteServiceWorkerCaches(cacheNames) {
  return cacheNames.filter((cacheName) => LEGACY_CACHE_NAMES.has(cacheName))
}
