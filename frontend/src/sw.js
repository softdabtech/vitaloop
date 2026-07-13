
import { clientsClaim } from 'workbox-core'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST || [])

const navigationHandler = new NetworkFirst({
  cacheName: 'navigation-shell-v20260713-wellbeing',
  networkTimeoutSeconds: 8,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
})
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api\//, /^\/auth\//, /^\/admin/, /^\/__/],
})
registerRoute(navigationRoute)

registerRoute(
  ({ url }) => /^https:\/\/fonts\.googleapis\.com\/.*/i.test(url.href),
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  ({ url }) => /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)/i.test(url.href),
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type !== 'SHOW_NOTIFICATION') return

  const title = data.title || 'Vitaloop reminder'
  const options = {
    icon: '/icons/icon-192.png?v=20260601-brand',
    badge: '/icons/icon-192.png?v=20260601-brand',
    ...data.options,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Vitaloop reminder', body: event.data.text() }
  }

  const title = payload.title || 'Vitaloop reminder'
  const options = {
    body: payload.body || 'Open Vitaloop to continue your health progress.',
    icon: payload.icon || '/icons/icon-192.png?v=20260601-brand',
    badge: payload.badge || '/icons/icon-192.png?v=20260601-brand',
    tag: payload.tag || 'vitaloop-reminder',
    data: {
      url: payload.url || '/dashboard/',
    },
    requireInteraction: Boolean(payload.requireInteraction),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/dashboard/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            await client.navigate(targetUrl)
          }
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
