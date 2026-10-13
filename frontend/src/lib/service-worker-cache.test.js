import { describe, expect, it } from 'vitest'
import { NAVIGATION_CACHE_NAME, obsoleteServiceWorkerCaches } from './service-worker-cache.js'

describe('service worker cache lifecycle', () => {
  it('uses a new navigation cache and removes the legacy shell cache', () => {
    expect(NAVIGATION_CACHE_NAME).toBe('navigation-shell-v2')
    expect(obsoleteServiceWorkerCaches([
      'navigation-shell',
      NAVIGATION_CACHE_NAME,
      'workbox-precache-v2',
    ])).toEqual(['navigation-shell'])
  })

  it('does not remove current or unrelated static asset caches', () => {
    expect(obsoleteServiceWorkerCaches([
      NAVIGATION_CACHE_NAME,
      'google-fonts-cache',
      'image-cache',
    ])).toEqual([])
  })
})
